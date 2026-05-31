import Papa from 'papaparse'

/**
 * Decodes a CSV file buffer using the correct character encoding.
 *
 * Swedish bank exports vary:
 *   - SEB: UTF-8 with BOM
 *   - Amex: UTF-8
 *   - Swedbank: Windows-1252 (Latin-1) — this is what breaks å/ä/ö
 *
 * Strategy: try UTF-8 strictly. If it produces replacement characters (U+FFFD)
 * or fails, fall back to Windows-1252.
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  // Check for UTF-8 BOM (EF BB BF) → definitely UTF-8
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes)
  }

  // Try strict UTF-8 — throws on invalid sequences
  try {
    const strict = new TextDecoder('utf-8', { fatal: true })
    return strict.decode(bytes)
  } catch {
    // Invalid UTF-8 → assume Windows-1252 (covers Swedbank)
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

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
 * Amex CSV format (Swedish export is a hybrid):
 *   - UTF-8
 *   - Comma-separated, amounts quoted with comma decimals: "1350,00"
 *   - MM/DD/YYYY dates (American), even in Swedish exports
 *   - Headers vary by locale:
 *       EN: Date, Description, Card Member, Account #, Amount
 *       SV: Datum, Beskrivning, Kortmedlem, Konto #, Belopp
 *   - Positive amount = expense (correct sign for our model)
 */
function parseAmex(csvText: string): BankParseResult {
  const transactions: NormalizedTransaction[] = []
  const errors: string[] = []

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    delimiter: ',',
    skipEmptyLines: true,
  })

  // Resolve column names across EN/SV variants
  const headers = result.meta.fields || []
  const find = (...candidates: string[]) =>
    headers.find((h) => candidates.some((c) => h.trim().toLowerCase() === c.toLowerCase()))

  const dateKey = find('Datum', 'Date')
  const descKey = find('Beskrivning', 'Description')
  const amountKey = find('Belopp', 'Amount')

  if (!dateKey || !descKey || !amountKey) {
    errors.push(
      `Kunde inte hitta kolumnerna. Hittade: ${headers.join(', ')}. ` +
      `Förväntar Datum/Date, Beskrivning/Description, Belopp/Amount.`
    )
    return { transactions, errors, detectedBank: 'Amex' }
  }

  for (const row of result.data) {
    const date = parseUSDate(row[dateKey] || '')
    // Collapse multiple spaces in Amex descriptions ("EASYPARK     STOCKHOLM")
    const description = (row[descKey] || '').replace(/\s{2,}/g, ' ').trim()
    const rawAmount = parseSwedishAmount(row[amountKey] || '')

    if (!date || !description || rawAmount === null) continue

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

  // Amex: has Kortmedlem/Card Member or Konto # column, or MM/DD/YYYY dates
  if (first200.includes('kortmedlem') || first200.includes('card member') || first200.includes('konto #')) return 'Amex'

  if (first200.includes('bokföringsdatum') && first200.includes(';')) return 'SEB'
  if (first200.includes('bokföringsdag') || first200.includes('clearingnummer')) return 'Swedbank'
  if (first200.includes('card member') || /^\s*"?date"?,/i.test(csvText)) return 'Amex'

  // Amex Swedish header pattern
  if (/^datum,beskrivning/i.test(csvText.trim())) return 'Amex'

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
