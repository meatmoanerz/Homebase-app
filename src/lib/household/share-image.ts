import { formatCurrency } from '@/lib/utils/formatters'

export interface SummaryImageInput {
  title: string
  subtitle: string
  transfers: { label: string; amount: number }[]
  rows: { name: string; amount: number }[]
  total: number
  footer: string
}

// Light theme always: the image is read in Messages, not in the app
const COLORS = {
  background: '#faf6ee',
  text: '#2a2420',
  muted: '#6b5f54',
  accent: '#9a6a3a',
  line: '#ebe1d2',
  strongLine: '#d9ccb8',
  hero: '#3d3128',
  heroText: '#f4ede3',
  heroMuted: 'rgba(244,237,227,0.75)',
}

const WIDTH = 390 // CSS px; drawn at 3x
const SCALE = 3
const PAD = 24

/** The app's fonts, as next/font registered them ("'__Inter_xyz', ..."). */
function fontStack(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.body).getPropertyValue(variable).trim()
  return value ? `${value}, ${fallback}` : fallback
}

/**
 * Draws the collapsed Gemensam ekonomi summary as a PNG: what to transfer, the
 * categories it covers and the total. Drawn on a canvas instead of
 * screenshotting the page, so the image is the same whatever the screen shows.
 */
export async function drawSummaryImage(input: SummaryImageInput): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready

  const sans = fontStack('--font-inter', 'system-ui, sans-serif')
  const serif = fontStack('--font-fraunces', 'Georgia, serif')

  const heroHeight = 16 + 18 + input.transfers.length * 30 + 12
  const rowHeight = 30
  const height = PAD + 58 + 20 + heroHeight + 24 + 20 + input.rows.length * rowHeight + 44 + 28 + PAD

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, WIDTH, height)

  let y = PAD

  // Title, subtitle and brand
  ctx.fillStyle = COLORS.text
  ctx.font = `600 24px ${serif}`
  ctx.fillText(input.title, PAD, y + 24)
  ctx.fillStyle = COLORS.accent
  ctx.font = `600 11px ${sans}`
  ctx.textAlign = 'right'
  ctx.fillText('HOMEBASE', WIDTH - PAD, y + 14)
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.muted
  ctx.font = `400 14px ${sans}`
  ctx.fillText(input.subtitle, PAD, y + 50)
  y += 58 + 20

  // Transfers on the dark card
  ctx.fillStyle = COLORS.hero
  roundRect(ctx, PAD, y, WIDTH - PAD * 2, heroHeight, 14)
  ctx.fill()
  ctx.fillStyle = COLORS.heroMuted
  ctx.font = `400 12px ${sans}`
  ctx.fillText('Att föra över', PAD + 16, y + 28)
  let ty = y + 28 + 30
  for (const transfer of input.transfers) {
    ctx.fillStyle = COLORS.heroText
    ctx.font = `400 14px ${sans}`
    ctx.fillText(transfer.label, PAD + 16, ty)
    ctx.font = `700 18px ${sans}`
    ctx.textAlign = 'right'
    ctx.fillText(formatCurrency(transfer.amount), WIDTH - PAD - 16, ty)
    ctx.textAlign = 'left'
    ty += 30
  }
  y += heroHeight + 24

  // Categories it covers
  ctx.fillStyle = COLORS.muted
  ctx.font = `400 12px ${sans}`
  ctx.fillText('Det täcker på gemensamt konto', PAD, y + 12)
  y += 20
  for (const row of input.rows) {
    line(ctx, y, COLORS.line, 1)
    ctx.fillStyle = COLORS.text
    ctx.font = `400 14px ${sans}`
    ctx.fillText(row.name, PAD, y + 20)
    ctx.textAlign = 'right'
    ctx.fillText(formatCurrency(row.amount), WIDTH - PAD, y + 20)
    ctx.textAlign = 'left'
    y += rowHeight
  }
  line(ctx, y, COLORS.strongLine, 2)
  ctx.fillStyle = COLORS.text
  ctx.font = `700 15px ${sans}`
  ctx.fillText('Totalt', PAD, y + 27)
  ctx.textAlign = 'right'
  ctx.fillText(formatCurrency(input.total), WIDTH - PAD, y + 27)
  ctx.textAlign = 'left'
  y += 44

  ctx.fillStyle = COLORS.muted
  ctx.font = `400 11px ${sans}`
  ctx.fillText(input.footer, PAD, y + 16)

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), 'image/png')
  )
}

function line(ctx: CanvasRenderingContext2D, y: number, color: string, width: number) {
  ctx.fillStyle = color
  ctx.fillRect(PAD, y, WIDTH - PAD * 2, width)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Opens the share sheet with the image (Messages, Mail …). Falls back to
 * downloading it where sharing files is not supported (desktop browsers).
 * Returns false when the person closed the share sheet.
 */
export async function shareImage(blob: Blob, fileName: string, title: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: 'image/png' })
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false
      throw error
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}
