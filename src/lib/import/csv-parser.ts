import Papa from 'papaparse'

/**
 * Homebase standard CSV import format.
 *
 * Claude generates this CSV from raw bank exports (SEB/Swedbank/Amex) in the
 * chat, and the user uploads it here. No OpenAI processing needed in-app.
 *
 * Expected columns (header row required, case-insensitive):
 *   date           — YYYY-MM-DD
 *   description    — free text
 *   amount         — positive number for expenses, negative for refunds
 *   category       — category name (must match an existing category, else flagged)
 *   cost_assignment— "personal" | "shared" | "partner" (default: shared)
 *   bank           — "SEB" | "Swedbank" | "Amex" (controls cash-flow logic)
 *   on_credit_card — "true" | "false" (is this an Amex/CCM purchase)
 *   notes          — optional free text
 */

export interface ParsedCsvRow {
  rowIndex: number
  date: string
  description: string
  amount: number
  category: string
  costAssignment: 'personal' | 'shared' | 'partner'
  bank: string
  onCreditCard: boolean
  notes: string
  // Validation state
  warnings: string[]
  categoryMatched: boolean
}

export interface CsvParseResult {
  rows: ParsedCsvRow[]
  globalErrors: string[]
  totalAmount: number
  validRowCount: number
  warningRowCount: number
}

const VALID_ASSIGNMENTS = ['personal', 'shared', 'partner']
const VALID_BANKS = ['seb', 'swedbank', 'amex']

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_')
}

function parseAmount(raw: string): number | null {
  if (!raw) return null
  // Handle Swedish format: "1 234,56" or "1234.56" or "-1234,56"
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/kr/gi, '')
    .replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseBool(raw: string): boolean {
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v === 'true' || v === 'ja' || v === 'yes' || v === '1'
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) return trimmed.replace(/\//g, '-')
  // DD/MM/YYYY or MM/DD/YYYY — ambiguous, assume DD/MM for Swedish
  const dmy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  return null
}

/**
 * Parses Homebase standard CSV text into structured rows with validation.
 *
 * @param csvText raw CSV content
 * @param knownCategories list of existing category names for matching
 */
export function parseHomebaseCsv(
  csvText: string,
  knownCategories: string[]
): CsvParseResult {
  const globalErrors: string[] = []
  const rows: ParsedCsvRow[] = []

  const lowerCats = new Set(knownCategories.map((c) => c.toLowerCase()))

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  })

  if (result.errors.length > 0) {
    for (const err of result.errors.slice(0, 5)) {
      globalErrors.push(`Rad ${err.row}: ${err.message}`)
    }
  }

  const headers = result.meta.fields || []
  const required = ['date', 'description', 'amount']
  const missing = required.filter((r) => !headers.includes(r))
  if (missing.length > 0) {
    globalErrors.push(`Saknar obligatoriska kolumner: ${missing.join(', ')}`)
    return { rows: [], globalErrors, totalAmount: 0, validRowCount: 0, warningRowCount: 0 }
  }

  result.data.forEach((raw, i) => {
    const warnings: string[] = []

    const date = normalizeDate(raw.date || '')
    if (!date) warnings.push('Ogiltigt datum')

    const description = (raw.description || '').trim()
    if (!description) warnings.push('Saknar beskrivning')

    const amount = parseAmount(raw.amount || '')
    if (amount === null) warnings.push('Ogiltigt belopp')

    const category = (raw.category || '').trim()
    const categoryMatched = category ? lowerCats.has(category.toLowerCase()) : false
    if (category && !categoryMatched) {
      warnings.push(`Okänd kategori: "${category}"`)
    }
    if (!category) {
      warnings.push('Ingen kategori angiven')
    }

    let costAssignment: ParsedCsvRow['costAssignment'] = 'shared'
    const ca = (raw.cost_assignment || '').trim().toLowerCase()
    if (ca) {
      if (VALID_ASSIGNMENTS.includes(ca)) {
        costAssignment = ca as ParsedCsvRow['costAssignment']
      } else {
        warnings.push(`Okänd kostnadsdelning: "${ca}" (använder Delad)`)
      }
    }

    const bank = (raw.bank || '').trim()
    if (bank && !VALID_BANKS.includes(bank.toLowerCase())) {
      warnings.push(`Okänd bank: "${bank}"`)
    }

    const onCreditCard = parseBool(raw.on_credit_card || '')
    const notes = (raw.notes || '').trim()

    rows.push({
      rowIndex: i,
      date: date || '',
      description,
      amount: amount ?? 0,
      category,
      costAssignment,
      bank,
      onCreditCard,
      notes,
      warnings,
      categoryMatched,
    })
  })

  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0)
  const warningRowCount = rows.filter((r) => r.warnings.length > 0).length
  const validRowCount = rows.length - warningRowCount

  return { rows, globalErrors, totalAmount, validRowCount, warningRowCount }
}

/**
 * Generates an example CSV template the user can reference.
 */
export function getCsvTemplate(): string {
  return [
    'date,description,amount,category,cost_assignment,bank,on_credit_card,notes',
    '2026-05-20,ICA Maxi Solna,682,Mat,shared,SEB,false,',
    '2026-05-21,Spotify Premium,199,Streaming,shared,Amex,true,Familjeabonnemang',
    '2026-05-22,SL månadskort,980,Kollektivtrafik,personal,SEB,false,',
  ].join('\n')
}
