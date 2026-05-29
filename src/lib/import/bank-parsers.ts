import Papa from 'papaparse'

/**
 * Each bank exports transactions in a slightly different CSV format.
 * These parsers normalize them into a common shape so the import flow
 * can apply category mappings and write to expenses.
 */

export interface NormalizedTransaction {
  date: string // YYYY-MM-DD
  description: string
  amount: number // positive for expenses, negative for refunds/income
  bank: 'SEB' | 'Swedbank' | 'Amex'
  /** Original raw row for debugging / preserving notes */
  rawRow?: Record<string, string>
}

export interface BankParseResult {
  transactions: NormalizedTransaction[]
  errors: string[]
  detectedBank: 'SEB' | 'Swedbank' | 'Amex' | 'Unknown'
}

// ----- Date helpers -----

function parseISODate(s: string): string | null {
  const trimmed = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  return null
}

function parseSwedishDate(s: string): string | null {
  // "2026-05-22" or "2026/05/22"
  const trimmed = s.trim().replace(/\//g, '-')
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // "22/05/2026" (DD/MM/YYYY) — Swedish-style
  const m = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function parseUSDate(s: string): string | null {
  // MM/DD/YYYY (Amex)
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const mm = m[1].padStart(2, '0')
  const dd = m[2].padStart(2, '0')
  return `${m[3]}-${mm}-${dd}`
}

// ----- Amount helpers -----

function parseSwedishAmount(s: string): number | null {
  if (!s) return null
  const cleaned = s.toString().replace(/\s/g, '').replace(/kr/gi, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// ----- SEB -----

/**
 * SEB CSV format:
 *   - UTF-8 with BOM
 *   - Semicolon-separated
 *   - Headers: "Bokföringsdatum";"Valutadatum";"Verifikationsnummer";"Text";"Belopp";"Saldo"
 *   - Amount: negative for expenses, positive for incoming
 */
function parseSEB(csvText: string): BankParseResult {
  const transactions: NormalizedTransaction[] = []
  const errors: string[] = []

  // Strip BOM if present
  const cleaned = csvText.replace(/^\uFEFF/, '')

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
  })

  for (const row of result.data) {
    const date = parseSwedishDate(row['Bokföringsdatum'] || row['Bokforingsdatum'] || '')
    const description = (row['Text'] || '').trim()
    const rawAmount = parseSwedishAmount(row['Belopp'] || '')

    if (!date || !description || rawAmount === null) continue

    // Skip Swish to Amanda per project rules
    if (description.includes('46705204919')) continue

    // SEB shows expenses as negative — flip to positive for our model
    transactions.push({
      date,
      description,
      amount: -rawAmount,
      bank: 'SEB',
      rawRow: row,
    })
  }

  if (result.errors.length > 0) {
    errors.push(...result.errors.slice(0, 3).map(e => `Rad ${e.row}: ${e.message}`))
  }

  return { transactions, errors, detectedBank: 'SEB' }
}

// ----- Swedbank -----

/**
 * Swedbank CSV format:
 *   - Windows-1252 encoded (we assume already decoded as UTF-8 in browser)
 *   - Comma-separated
 *   - Row 1 is metadata, skip
 *   - Headers row 2: "Radnummer","Clearingnummer","Kontonummer","Produkt",
 *                    "Valuta","Bokföringsdag","Transaktionsdag","Valutadag",
 *                    "Referens","Beskrivning","Belopp","Bokfört saldo"
 */
function parseSwedbank(csvText: string): BankParseResult {
  const transactions: NormalizedTransaction[] = []
  const errors: string[] = []

  // Try to skip metadata row by looking for the actual header line
  const lines = csvText.split(/\r?\n/)
  let headerIdx = lines.findIndex(l => l.includes('Bokföringsdag') || l.includes('Beskrivning'))
  if (headerIdx === -1) headerIdx = 1 // fallback

  const body = lines.slice(headerIdx).join('\n')

  const result = Papa.parse<Record<string, string>>(body, {
    header: true,
    delimiter: ',',
    skipEmptyLines: true,
  })

  for (const row of result.data) {
    const date = parseSwedishDate(
      row['Bokföringsdag'] || row['Transaktionsdag'] || row['Bokforingsdag'] || ''
    )
    const description = (row['Beskrivning'] || row['Referens'] || '').trim()
    const rawAmount = parseSwedishAmount(row['Belopp'] || '')

    if (!date || !description || rawAmount === null) continue
    if (description.includes('46705204919')) continue

    transactions.push({
      date,
      description,
      amount: -rawAmount,
      bank: 'Swedbank',
      rawRow: row,
    })
  }

  if (result.errors.length > 0) {
    errors.push(...result.errors.slice(0, 3).map(e => `Rad ${e.row}: ${e.message}`))
  }

  return { transactions, errors, detectedBank: 'Swedbank' }
}

// ----- Amex -----

/**
 * Amex CSV format:
 *   - UTF-8
 *   - Comma-separated
 *   - MM/DD/YYYY dates
 *   - Headers: "Date","Description","Card Member","Account #","Amount"
 *   - Amount sign is flipped (positive = expense)
 */
function parseAmex(csvText: string): BankParseResult {
  const transactions: NormalizedTransaction[] = []
  const errors: string[] = []

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    delimiter: ',',
    skipEmptyLines: true,
  })

  for (const row of result.data) {
    const date = parseUSDate(row['Date'] || '')
    const description = (row['Description'] || '').trim()
    const rawAmount = parseSwedishAmount(row['Amount'] || '')

    if (!date || !description || rawAmount === null) continue

    // Amex: positive = expense (already correct sign)
    transactions.push({
      date,
      description,
      amount: rawAmount,
      bank: 'Amex',
      rawRow: row,
    })
  }

  if (result.errors.length > 0) {
    errors.push(...result.errors.slice(0, 3).map(e => `Rad ${e.row}: ${e.message}`))
  }

  return { transactions, errors, detectedBank: 'Amex' }
}

// ----- Auto-detection -----

export function detectBank(csvText: string): 'SEB' | 'Swedbank' | 'Amex' | 'Unknown' {
  const first200 = csvText.slice(0, 1000).toLowerCase()

  if (first200.includes('bokföringsdatum') && first200.includes(';')) return 'SEB'
  if (first200.includes('bokföringsdag') || first200.includes('clearingnummer')) return 'Swedbank'
  if (first200.includes('card member') || /^\s*"?date"?,/i.test(csvText)) return 'Amex'

  // Heuristic: semicolon-delimited Swedish format → SEB
  if (csvText.includes(';') && /\d{4}-\d{2}-\d{2}/.test(csvText)) return 'SEB'

  return 'Unknown'
}

export function parseBankCsv(
  csvText: string,
  bank: 'SEB' | 'Swedbank' | 'Amex' | 'auto'
): BankParseResult {
  const actualBank = bank === 'auto' ? detectBank(csvText) : bank

  switch (actualBank) {
    case 'SEB':
      return parseSEB(csvText)
    case 'Swedbank':
      return parseSwedbank(csvText)
    case 'Amex':
      return parseAmex(csvText)
    default:
      return {
        transactions: [],
        errors: ['Kunde inte identifiera bankformat. Välj bank manuellt.'],
        detectedBank: 'Unknown',
      }
  }
}
