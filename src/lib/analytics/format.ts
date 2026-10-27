import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

/** "2026-10" → "okt" (or "okt 2026" with year), period = budget month. */
export function formatPeriodShort(period: string, withYear = false): string {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return format(date, withYear ? 'MMMM yyyy' : 'MMM', { locale: sv }).replace('.', '')
}

/** Signed percentage like "+12 %" / "−8 %", null-safe. */
export function formatChange(change: number | null): string {
  if (change == null || !isFinite(change)) return '–'
  const pct = Math.round(change * 100)
  if (pct === 0) return '±0 %'
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`
}
