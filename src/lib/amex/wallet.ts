// Parsing helpers for the iPhone Wallet "Transaktion" shortcut.
// The shortcut sends the raw Wallet values, e.g. amount "1 234,50 kr" or "€12.50".

export interface ParsedWalletAmount {
  amount: number
  currency: string // 'SEK' or detected foreign currency code/symbol
}

const FOREIGN_MARKERS: Array<[RegExp, string]> = [
  [/€|\bEUR\b/i, 'EUR'],
  [/\$|\bUSD\b/i, 'USD'],
  [/£|\bGBP\b/i, 'GBP'],
  [/\bNOK\b/i, 'NOK'],
  [/\bDKK\b/i, 'DKK'],
  [/\bCHF\b/i, 'CHF'],
]

export function parseWalletAmount(raw: unknown): ParsedWalletAmount | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { amount: Math.round(raw * 100) / 100, currency: 'SEK' } : null
  }
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text) return null

  let currency = 'SEK'
  if (!/\bkr\b|\bSEK\b/i.test(text)) {
    for (const [pattern, code] of FOREIGN_MARKERS) {
      if (pattern.test(text)) {
        currency = code
        break
      }
    }
  }

  const negative = /^[^\d]*[-−]/.test(text)
  let digits = text.replace(/[^\d.,]/g, '')
  if (!/\d/.test(digits)) return null

  const lastComma = digits.lastIndexOf(',')
  const lastDot = digits.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: the last one is the decimal separator.
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const thousandSep = decimalSep === ',' ? '.' : ','
    digits = digits.split(thousandSep).join('').replace(decimalSep, '.')
  } else if (lastComma >= 0) {
    const decimals = digits.length - lastComma - 1
    // Swedish format uses comma as decimal separator. Foreign "1,234" = thousands.
    digits = currency !== 'SEK' && decimals === 3
      ? digits.split(',').join('')
      : digits.slice(0, lastComma).split(',').join('') + '.' + digits.slice(lastComma + 1)
  } else if (lastDot >= 0) {
    const decimals = digits.length - lastDot - 1
    digits = decimals === 3
      ? digits.split('.').join('')
      : digits.slice(0, lastDot).split('.').join('') + '.' + digits.slice(lastDot + 1)
  }

  const value = Number(digits)
  if (!Number.isFinite(value)) return null
  const amount = Math.round(value * 100) / 100
  return { amount: negative ? -amount : amount, currency }
}

export function stockholmToday(now = new Date()): string {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function normalizeMerchant(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, 200)
  return cleaned || null
}
