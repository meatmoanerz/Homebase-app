import { chromium, type Locator, type Page } from 'playwright-core'

const AMEX_ACTIVITY_URL = 'https://global.americanexpress.com/activity'
const BROWSERBASE_API_URL = 'https://api.browserbase.com/v1'

interface BrowserbaseSession {
  id: string
  connectUrl: string
  region: string
}

interface BrowserbaseDownload {
  id: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
}

interface BrowserbaseDownloadList {
  downloads: BrowserbaseDownload[]
  total: number
}

export type AmexBrowserErrorCode =
  | 'CONFIG_MISSING'
  | 'SESSION_CREATE_FAILED'
  | 'REAUTH_REQUIRED'
  | 'EXPORT_UI_NOT_FOUND'
  | 'DOWNLOAD_FAILED'

export class AmexBrowserError extends Error {
  constructor(
    public readonly code: AmexBrowserErrorCode,
    message: string,
    public readonly sessionId?: string
  ) {
    super(message)
    this.name = 'AmexBrowserError'
  }
}

export interface DownloadAmexCsvResult {
  csvText: string
  filename: string
  sessionId: string
  sessionUrl: string
}

async function createBrowserbaseSession(
  apiKey: string,
  contextId: string
): Promise<BrowserbaseSession> {
  const response = await fetch(`${BROWSERBASE_API_URL}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bb-api-key': apiKey,
    },
    body: JSON.stringify({
      region: 'eu-central-1',
      timeout: 180,
      keepAlive: false,
      browserSettings: {
        context: { id: contextId, persist: false },
        solveCaptchas: false,
        recordSession: true,
        logSession: true,
      },
      userMetadata: { workflow: 'homebase-amex-sync' },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new AmexBrowserError(
      'SESSION_CREATE_FAILED',
      `Browserbase kunde inte skapa en session (${response.status}): ${detail.slice(0, 300)}`
    )
  }

  return response.json() as Promise<BrowserbaseSession>
}

async function clickFirstVisible(locators: Locator[]): Promise<boolean> {
  for (const locator of locators) {
    const target = locator.first()
    if (await target.isVisible().catch(() => false)) {
      await target.click()
      return true
    }
  }
  return false
}

async function visibleControlLabels(page: Page): Promise<string[]> {
  const labels = await page
    .locator('button:visible, [role="button"]:visible')
    .allTextContents()
    .catch(() => [])

  return (labels as string[])
    .map((label: string) => label.replace(/\s+/g, ' ').trim())
    .filter((label: string) => label.length > 0 && label.length < 100)
    .slice(0, 30)
}

async function setDateRange(page: Page, startDate: string, endDate: string): Promise<void> {
  const customRange = /anpassat datumintervall|eget datumintervall|custom date range/i
  await clickFirstVisible([
    page.getByRole('button', { name: customRange }),
    page.getByRole('link', { name: customRange }),
    page.getByText(customRange, { exact: true }),
  ])

  const startInput = page
    .getByLabel(/startdatum|från datum|from date|start date/i)
    .or(page.locator('input[type="date"][name*="start" i], input[name*="from" i]'))
    .first()
  const endInput = page
    .getByLabel(/slutdatum|till datum|to date|end date/i)
    .or(page.locator('input[type="date"][name*="end" i], input[name*="to" i]'))
    .first()

  await startInput.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined)
  await endInput.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined)

  if (!(await startInput.isVisible().catch(() => false)) || !(await endInput.isVisible().catch(() => false))) {
    const dateInputs = page.locator('input[type="date"]:visible')
    if ((await dateInputs.count()) < 2) {
      throw new AmexBrowserError('EXPORT_UI_NOT_FOUND', 'Kunde inte hitta Amex datumfält.')
    }
    await dateInputs.nth(0).fill(startDate)
    await dateInputs.nth(1).fill(endDate)
  } else {
    await fillDateControl(startInput, startDate)
    await fillDateControl(endInput, endDate)
  }

  await clickFirstVisible([
    page.getByRole('button', { name: /^(sök|search|visa|apply)$/i }),
    page.locator('button[type="submit"]:visible'),
  ])
  await page.getByRole('button', { name: /^(ladda (ner|ned)|download|exportera|export)$/i })
    .or(page.getByRole('link', { name: /^(ladda (ner|ned)|download|exportera|export)$/i }))
    .first().waitFor({ state: 'visible', timeout: 30_000 })
}

async function fillDateControl(control: Locator, date: string): Promise<void> {
  if ((await control.getAttribute('role')) !== 'group') {
    await control.fill(date)
    return
  }
  const fields = control.locator('input:not([type="hidden"]), [contenteditable="true"]')
  const count = await fields.count()
  if (count !== 3) {
    throw new AmexBrowserError('EXPORT_UI_NOT_FOUND', `Okänt datumformat (${count} fält).`)
  }
  // The Swedish Amex control presents separate year/month/day fields.
  const parts = date.split('-')
  for (let index = 0; index < parts.length; index++) {
    await fields.nth(index).fill(parts[index])
    await fields.nth(index).press('Tab')
  }
}

async function triggerCsvDownload(page: Page): Promise<void> {
  const opened = await clickFirstVisible([
    page.getByRole('button', { name: /^(ladda (ner|ned)|download|exportera|export)$/i }),
    page.getByRole('link', { name: /^(ladda (ner|ned)|download|exportera|export)$/i }),
    page.locator('button[aria-label*="download" i], button[title*="download" i]'),
    page.locator('[data-testid*="download" i]'),
  ])

  if (!opened) {
    throw new AmexBrowserError(
      'EXPORT_UI_NOT_FOUND',
      `Kunde inte hitta exportknappen. Synliga knappar: ${(await visibleControlLabels(page)).join(' | ')}`
    )
  }

  const csvOption = page.getByLabel(/^csv$/i).or(page.getByText(/^csv$/i, { exact: true })).first()
  await csvOption.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined)
  if (await csvOption.isVisible().catch(() => false)) {
    await csvOption.click()
  } else {
    throw new AmexBrowserError(
      'EXPORT_UI_NOT_FOUND',
      `Kunde inte välja CSV. Synliga knappar: ${(await visibleControlLabels(page)).join(' | ')}`
    )
  }

  const extraDetails = page
    .getByLabel(/alla.*(transaktions)?detaljer|inkludera alla ytterligare transaktionsuppgifter|additional transaction details|include.*details/i)
    .first()
  if (await extraDetails.isVisible().catch(() => false) && !(await extraDetails.isChecked())) {
    await page.locator('label[for="axp-activity-download-body-checkbox-options-includeAll"]').click()
    if (!(await extraDetails.isChecked())) {
      throw new AmexBrowserError('EXPORT_UI_NOT_FOUND', 'Kunde inte välja ytterligare transaktionsuppgifter.')
    }
  }

  const dialog = page.locator('[role="dialog"]:visible').last()
  const downloadButtons = [
    dialog.getByRole('button', { name: /^(hämta|ladda (ner|ned)|download|exportera|export)$/i }),
    page.getByRole('button', { name: /^hämta$/i }),
  ]

  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 }).catch(() => null)
  const submitted = await clickFirstVisible(downloadButtons)
  if (!submitted) {
    throw new AmexBrowserError('EXPORT_UI_NOT_FOUND', 'Kunde inte starta CSV-nedladdningen.')
  }

  const download = await downloadPromise
  if (!download) throw new AmexBrowserError('DOWNLOAD_FAILED', 'CSV-nedladdningen startade inte inom 30 sekunder.')
  const failure = await download.failure()
  if (failure) throw new AmexBrowserError('DOWNLOAD_FAILED', failure)
}

async function retrieveCsv(apiKey: string, sessionId: string): Promise<{ text: string; filename: string }> {
  const deadline = Date.now() + 25_000

  while (Date.now() < deadline) {
    const listResponse = await fetch(
      `${BROWSERBASE_API_URL}/downloads?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: { 'x-bb-api-key': apiKey } }
    )

    if (!listResponse.ok) {
      throw new AmexBrowserError(
        'DOWNLOAD_FAILED',
        `Kunde inte läsa Browserbase-nedladdningar (${listResponse.status}).`,
        sessionId
      )
    }

    const list = (await listResponse.json()) as BrowserbaseDownloadList
    const csv = [...list.downloads]
      .filter((item) => item.filename.toLowerCase().endsWith('.csv') || item.mimeType.includes('csv'))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]

    if (csv) {
      const fileResponse = await fetch(`${BROWSERBASE_API_URL}/downloads/${csv.id}`, {
        headers: { 'x-bb-api-key': apiKey, Accept: 'application/octet-stream' },
      })
      if (!fileResponse.ok) {
        throw new AmexBrowserError(
          'DOWNLOAD_FAILED',
          `Kunde inte hämta CSV-filen (${fileResponse.status}).`,
          sessionId
        )
      }
      return { text: await fileResponse.text(), filename: csv.filename }
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new AmexBrowserError('DOWNLOAD_FAILED', 'Ingen CSV-fil hittades inom 25 sekunder.', sessionId)
}

export async function downloadAmexCsv(
  startDate: string,
  endDate: string
): Promise<DownloadAmexCsvResult> {
  const apiKey = process.env.BROWSERBASE_API_KEY
  const contextId = process.env.BROWSERBASE_CONTEXT_ID

  if (!apiKey || !contextId) {
    throw new AmexBrowserError(
      'CONFIG_MISSING',
      'BROWSERBASE_API_KEY eller BROWSERBASE_CONTEXT_ID saknas.'
    )
  }

  const session = await createBrowserbaseSession(apiKey, contextId)
  const sessionUrl = `https://www.browserbase.com/sessions/${session.id}`
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined

  try {
    browser = await chromium.connectOverCDP(session.connectUrl)
    const context = browser.contexts()[0]
    const page = context.pages()[0] ?? (await context.newPage())

    const cdp = await context.newCDPSession(page)
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: 'downloads',
      eventsEnabled: true,
    })

    await page.goto(AMEX_ACTIVITY_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const loginVisible = await page
      .getByRole('button', { name: /logga in|log in|sign in/i })
      .first()
      .isVisible()
      .catch(() => false)
    if (/\/account\/login/i.test(page.url()) || loginVisible) {
      throw new AmexBrowserError(
        'REAUTH_REQUIRED',
        'Amex-sessionen behöver verifieras igen.',
        session.id
      )
    }

    await page
      .getByText(/anpassat datumintervall|eget datumintervall|custom date range/i)
      .or(page.getByRole('button', { name: /ladda (ner|ned)|download|exportera|export/i }))
      .or(page.locator('input[type="date"]'))
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => undefined)

    await setDateRange(page, startDate, endDate)
    await triggerCsvDownload(page)
    const file = await retrieveCsv(apiKey, session.id)

    return {
      csvText: file.text,
      filename: file.filename,
      sessionId: session.id,
      sessionUrl,
    }
  } catch (error) {
    if (error instanceof AmexBrowserError) {
      if (!error.sessionId) {
        throw new AmexBrowserError(error.code, error.message, session.id)
      }
      throw error
    }
    throw new AmexBrowserError(
      'DOWNLOAD_FAILED',
      error instanceof Error ? error.message : 'Okänt fel vid Amex-export.',
      session.id
    )
  } finally {
    await browser?.close().catch(() => undefined)
  }
}

