import { addDays, differenceInCalendarDays, format } from 'date-fns'
import type { ExpenseWithCategory } from '@/types'
import { shiftPeriod } from '@/lib/utils/budget-period'
import { isInvoiceLine } from '@/lib/analytics/analytics'
import type { KnownInvoice } from '@/lib/analytics/forecast'
import {
  getInvoiceBudgetPeriod,
  groupExpensesByCardAndPeriod,
  sumCardExpenses,
  type CardInvoice,
  type CreditCard,
} from '@/lib/utils/credit-cards'

/**
 * Credit-card invoices that are already (partly) known, per budget period in
 * which they are paid. Household totals over all cards; every card is handled
 * the same way, from its own break date and due day.
 *
 * Per card and invoice period:
 *  - Invoice amount entered in the CCM → exact.
 *  - Otherwise the purchases registered on that invoice, plus an estimate for
 *    the days not covered yet, at the card's pace (see cardPace).
 * A period is only returned when something is actually known for it — a pure
 * estimate is left to the regular forecast.
 */

/** Fully known invoice periods the card's usual pace is taken from. */
const RATE_WINDOW = 3
/**
 * Weight, in days, of the card's usual pace against the pace seen so far in
 * the open invoice period. After two weeks of data the open period counts as
 * much as the history, so a card that suddenly gets used a lot shows quickly.
 */
const PRIOR_DAYS = 14
/** Without history, the open period alone needs this many days to say anything. */
const MIN_OBSERVED_DAYS = 7
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
const toDate = (day: string) => new Date(`${day}T00:00:00`)

/**
 * The last day the card's purchases are known for: the day before its latest
 * bank-file import (a file covers up to the day it was exported), or its latest
 * purchase if that is later. Days after it may still get purchases.
 */
export function cardCoveredUntil(purchases: ExpenseWithCategory[]): Date | null {
  let until: string | null = null
  for (const e of purchases) {
    if (!until || e.date > until) until = e.date
    if (e.import_source === 'csv' && e.created_at) {
      const imported = format(addDays(new Date(e.created_at), -1), 'yyyy-MM-dd')
      if (imported > until) until = imported
    }
  }
  return until ? toDate(until) : null
}

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
    const window = (p: string) => invoiceWindow(p, card.invoice_break_date)
    const entered = (p: string) =>
      Number(invoices.find((i) => i.credit_card_id === card.id && i.period === p)?.actual_amount) || 0
    const registered = (p: string) => sumCardExpenses(byPeriod.get(p) ?? [])
    const coveredUntil = cardCoveredUntil([...byPeriod.values()].flat())

    // Usual spend per day: mean over the latest fully known invoice periods
    // since the card was first used — periods without purchases count as 0.
    const used = [
      ...byPeriod.keys(),
      ...invoices.filter((i) => i.credit_card_id === card.id && Number(i.actual_amount) > 0).map((i) => i.period),
    ].sort()
    const history: number[] = []
    if (coveredUntil && used.length > 0) {
      for (let p = used[0]; window(p).end <= coveredUntil; p = shiftPeriod(p, 1)) {
        const { start, end } = window(p)
        history.push((entered(p) || registered(p)) / daysIn(start, end))
      }
    }
    const recent = history.slice(-RATE_WINDOW)
    const usualPace = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : null

    /** Pace for the rest of an invoice period: its own pace so far, leaning on the usual pace. */
    const cardPace = (seen: number, seenDays: number) => {
      if (usualPace != null) return (seen + usualPace * PRIOR_DAYS) / (seenDays + PRIOR_DAYS)
      return seenDays >= MIN_OBSERVED_DAYS ? seen / seenDays : 0
    }

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
          const known = registered(invoicePeriod)
          const { start, end } = window(invoicePeriod)
          let estimated = 0
          if (coveredUntil) {
            const seenDays = coveredUntil < start ? 0 : daysIn(start, coveredUntil < end ? coveredUntil : end)
            const unknownDays = daysIn(start, end) - seenDays
            estimated = cardPace(known, seenDays) * unknownDays
          }
          part = {
            value: known + estimated,
            low: known + estimated * 0.5,
            high: known * (1 + UNREGISTERED_MARGIN) + estimated * 1.5,
            registered: known,
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
