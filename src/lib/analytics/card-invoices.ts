import { addDays, differenceInCalendarDays } from 'date-fns'
import type { ExpenseWithCategory } from '@/types'
import { shiftPeriod } from '@/lib/utils/budget-period'
import { isInvoiceLine } from '@/lib/analytics/analytics'
import { median, type KnownInvoice } from '@/lib/analytics/forecast'
import {
  getInvoiceBudgetPeriod,
  groupExpensesByCardAndPeriod,
  sumCardExpenses,
  type CardInvoice,
  type CreditCard,
} from '@/lib/utils/credit-cards'

/**
 * Credit-card invoices that are already (partly) known, per budget period in
 * which they are paid. Household totals over all cards.
 *
 * Per card and invoice period:
 *  - Invoice amount entered in the CCM → exact.
 *  - Otherwise the purchases registered on that invoice, plus an estimate for
 *    the days not covered yet (from the day after the card's latest imported
 *    purchase to the break date), at the card's usual daily rate.
 * A period is only returned when something is actually known for it — a pure
 * estimate is left to the regular forecast.
 */

const RATE_WINDOW = 3
/** Invoices tend to carry a few purchases nobody registered. */
const UNREGISTERED_MARGIN = 0.05

/** First and last purchase date on an invoice period (YYYY-MM) of a card. */
export function invoiceWindow(invoicePeriod: string, breakDate: number): { start: Date; end: Date } {
  const [y, m] = invoicePeriod.split('-').map(Number)
  const breakDay = (year: number, month0: number) =>
    new Date(year, month0, Math.min(breakDate, new Date(year, month0 + 1, 0).getDate()))
  return { start: breakDay(y, m - 2), end: addDays(breakDay(y, m - 1), -1) }
}

const daysIn = (start: Date, end: Date) => Math.max(0, differenceInCalendarDays(end, start) + 1)

export function knownCardInvoices(params: {
  /** Budget periods to look up (running period and the ones ahead). */
  budgetPeriods: string[]
  cards: CreditCard[]
  /** All expenses; card purchases are picked out here. */
  expenses: ExpenseWithCategory[]
  invoices: CardInvoice[]
  salaryDay: number
}): Map<string, KnownInvoice> {
  const { budgetPeriods, cards, invoices, salaryDay } = params
  const purchases = params.expenses.filter((e) => e.is_ccm && !isInvoiceLine(e))
  const grouped = groupExpensesByCardAndPeriod(purchases, cards)
  const result = new Map<string, KnownInvoice & { known: boolean }>()

  for (const card of cards) {
    const byPeriod = grouped.get(card.id) ?? new Map<string, ExpenseWithCategory[]>()
    const entered = (period: string) =>
      Number(invoices.find((i) => i.credit_card_id === card.id && i.period === period)?.actual_amount) || 0

    // Imported up to the card's latest purchase; later days are unknown.
    let latest: string | null = null
    for (const list of byPeriod.values()) {
      for (const e of list) if (!latest || e.date > latest) latest = e.date
    }
    const dataUntil = latest ? new Date(`${latest}T00:00:00`) : null

    // Usual spend per day, from the latest fully imported invoice periods.
    const rates = [...byPeriod.keys()]
      .filter((p) => dataUntil && invoiceWindow(p, card.invoice_break_date).end < dataUntil)
      .sort()
      .slice(-RATE_WINDOW)
      .map((p) => {
        const { start, end } = invoiceWindow(p, card.invoice_break_date)
        const amount = entered(p) || sumCardExpenses(byPeriod.get(p) ?? [])
        return amount / Math.max(1, daysIn(start, end))
      })
    const rate = median(rates)

    for (const budgetPeriod of budgetPeriods) {
      // Invoice periods paid in this budget period (normally exactly one).
      const invoicePeriods = [-2, -1, 0, 1]
        .map((k) => shiftPeriod(budgetPeriod, k))
        .filter((p) => getInvoiceBudgetPeriod(p, card, salaryDay) === budgetPeriod)

      for (const invoicePeriod of invoicePeriods) {
        const exact = entered(invoicePeriod)
        let part: { value: number; low: number; high: number; registered: number; estimated: number }
        if (exact > 0) {
          part = { value: exact, low: exact, high: exact, registered: exact, estimated: 0 }
        } else {
          const registered = sumCardExpenses(byPeriod.get(invoicePeriod) ?? [])
          const { start, end } = invoiceWindow(invoicePeriod, card.invoice_break_date)
          const unknownFrom = dataUntil && dataUntil >= start ? addDays(dataUntil, 1) : start
          const estimated = dataUntil ? rate * daysIn(unknownFrom, end) : 0
          part = {
            value: registered + estimated,
            low: registered + estimated * 0.5,
            high: registered * (1 + UNREGISTERED_MARGIN) + estimated * 1.5,
            registered,
            estimated,
          }
        }
        if (part.value <= 0) continue

        const acc = result.get(budgetPeriod) ?? { value: 0, low: 0, high: 0, registered: 0, estimated: 0, known: false }
        acc.value += part.value
        acc.low += part.low
        acc.high += part.high
        acc.registered += part.registered
        acc.estimated += part.estimated
        acc.known ||= part.registered > 0
        result.set(budgetPeriod, acc)
      }
    }
  }

  const known = new Map<string, KnownInvoice>()
  for (const [period, { known: isKnown, ...invoice }] of result) {
    if (isKnown) known.set(period, invoice)
  }
  return known
}
