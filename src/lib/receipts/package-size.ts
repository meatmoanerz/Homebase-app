/**
 * Pack size of a receipt line, so prices can be compared per kg, litre or
 * piece instead of per package ("Ägg 6-pack" → 6 st, "Kikärter 380G" →
 * 0.38 kg, "Babysemper 6P/200ML" → 1.2 l).
 */

export type MeasureUnit = 'kg' | 'l' | 'st'

export interface PackageSize {
  /** Amount in one package (one `quantity`). */
  size: number
  unit: MeasureUnit
}

const TO_BASE: Record<string, { unit: MeasureUnit; factor: number }> = {
  kg: { unit: 'kg', factor: 1 },
  hg: { unit: 'kg', factor: 0.1 },
  g: { unit: 'kg', factor: 0.001 },
  l: { unit: 'l', factor: 1 },
  dl: { unit: 'l', factor: 0.1 },
  cl: { unit: 'l', factor: 0.01 },
  ml: { unit: 'l', factor: 0.001 },
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`
const UNIT = String.raw`(kg|hg|g|dl|cl|ml|l)`
// Not part of a range or another number ("Up&Go S5 9-14kg" is a nappy size).
const START = String.raw`(?<![\d.,\-])`
const END = String.raw`(?![a-zåäöé0-9])`

const MULTI_RE = new RegExp(`${START}(\\d+)\\s*(?:x|×|p\\s*/|-?pack\\s*/?)\\s*${NUM}\\s*${UNIT}${END}`, 'i')
const AMOUNT_RE = new RegExp(`${START}${NUM}\\s*${UNIT}${END}`, 'i')
const COUNT_RE = new RegExp(`${START}(\\d+)\\s*-?\\s*(?:p|pack|pk|st)${END}`, 'i')

const num = (s: string) => Number(s.replace(',', '.'))
const round = (n: number) => Math.round(n * 10000) / 10000

/** Pack size written in the product name, or null. */
export function packageFromName(name: string): PackageSize | null {
  const multi = MULTI_RE.exec(name)
  if (multi) {
    const base = TO_BASE[multi[3].toLowerCase()]
    const size = num(multi[1]) * num(multi[2]) * base.factor
    if (size > 0 && size <= 30) return { size: round(size), unit: base.unit }
  }
  const amount = AMOUNT_RE.exec(name)
  if (amount) {
    const base = TO_BASE[amount[2].toLowerCase()]
    const size = num(amount[1]) * base.factor
    if (size > 0 && size <= 30) return { size: round(size), unit: base.unit }
  }
  const count = COUNT_RE.exec(name)
  if (count) {
    const size = Number(count[1])
    if (size >= 1 && size <= 60) return { size, unit: 'st' }
  }
  return null
}

/** "500 g", "1,5 l", "6 st" */
export function formatPackage(p: PackageSize): string {
  const fmt = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 2 })
  if (p.unit === 'kg' && p.size < 1) return `${fmt(p.size * 1000)} g`
  if (p.unit === 'l' && p.size < 0.1) return `${fmt(p.size * 1000)} ml`
  if (p.unit === 'l' && p.size < 1) return `${fmt(p.size * 10)} dl`
  return `${fmt(p.size)} ${p.unit}`
}
