import { format } from 'date-fns'
import type { ExpenseWithCategory } from '@/types'
import { getInvoicePeriod } from '@/hooks/use-expenses'
import { getBudgetPeriod } from '@/lib/utils/budget-period'
import { calculatePaymentSplit } from '@/lib/utils/ccm-split'

export type CreditCardIssuer = 'Amex' | 'Norwegian'

export interface CreditCard {
  id: string
  user_id: string
  name: string
  issuer: string | null
  invoice_break_date: number
  due_day: number
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CardInvoice {
  credit_card_id: string
  period: string
  actual_amount: number
  paid_at: string | null
}

/** Kortet en CCM-utgift ligger på (utgifter utan kort faller tillbaka på standardkortet). */
export function resolveExpenseCardId(
  expense: Pick<ExpenseWithCategory, 'credit_card_id'>,
  cards: CreditCard[]
): string | null {
  if (expense.credit_card_id && cards.some(c => c.id === expense.credit_card_id)) {
    return expense.credit_card_id
  }
  return getDefaultCard(cards)?.id ?? null
}

export function getDefaultCard(cards: CreditCard[]): CreditCard | null {
  if (cards.length === 0) return null
  return cards.find(c => c.is_default) ?? cards[0]
}

/** Fakturaperiod (YYYY-MM) för ett köp på ett visst kort. */
export function getCardInvoicePeriod(expenseDate: string, card: Pick<CreditCard, 'invoice_break_date'>): string {
  return getInvoicePeriod(expenseDate, card.invoice_break_date)
}

/**
 * Datum då fakturan för en fakturaperiod betalas.
 * Förfallodag efter brytdatum → samma månad (Amex: bryt 2, förfaller 27),
 * annars månaden efter.
 */
export function getInvoicePaymentDate(
  invoicePeriod: string,
  card: Pick<CreditCard, 'invoice_break_date' | 'due_day'>
): Date {
  const [year, month] = invoicePeriod.split('-').map(Number)
  const offset = card.due_day > card.invoice_break_date ? 0 : 1
  const first = new Date(year, month - 1 + offset, 1)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return new Date(first.getFullYear(), first.getMonth(), Math.min(card.due_day, daysInMonth))
}

/** Budgetperiod (YYYY-MM) då fakturan betalas. */
export function getInvoiceBudgetPeriod(
  invoicePeriod: string,
  card: Pick<CreditCard, 'invoice_break_date' | 'due_day'>,
  salaryDay: number
): string {
  return getBudgetPeriod(getInvoicePaymentDate(invoicePeriod, card), salaryDay).period
}

export function formatDueDate(invoicePeriod: string, card: Pick<CreditCard, 'invoice_break_date' | 'due_day'>): string {
  return format(getInvoicePaymentDate(invoicePeriod, card), 'yyyy-MM-dd')
}

/** Registrerad summa för en lista CCM-utgifter (utlägg räknas med hela beloppet). */
export function sumCardExpenses(expenses: ExpenseWithCategory[]): number {
  return expenses.reduce((sum, exp) => {
    if (exp.is_group_purchase) return sum + (exp.group_purchase_total || exp.amount)
    return sum + exp.amount
  }, 0)
}

/** Gruppera CCM-utgifter per kort och fakturaperiod. */
export function groupExpensesByCardAndPeriod(
  expenses: ExpenseWithCategory[],
  cards: CreditCard[]
): Map<string, Map<string, ExpenseWithCategory[]>> {
  const result = new Map<string, Map<string, ExpenseWithCategory[]>>()
  cards.forEach(c => result.set(c.id, new Map()))

  expenses.forEach(expense => {
    const cardId = resolveExpenseCardId(expense, cards)
    if (!cardId) return
    const card = cards.find(c => c.id === cardId)!
    const period = getCardInvoicePeriod(expense.date, card)
    const byPeriod = result.get(cardId)!
    byPeriod.set(period, [...(byPeriod.get(period) || []), expense])
  })

  // Nyaste perioden först
  result.forEach((byPeriod, cardId) => {
    const sorted = new Map(Array.from(byPeriod.entries()).sort(([a], [b]) => b.localeCompare(a)))
    result.set(cardId, sorted)
  })

  return result
}

export interface CreditCardBudgetPart {
  card: CreditCard
  invoicePeriod: string
  amount: number
  source: 'faktura' | 'registrerat'
  userAmount: number
  partnerAmount: number
}

/**
 * Kreditkortsraden i en budget = alla fakturor (alla kort) som BETALAS under
 * budgetperioden. Beloppet är fakturabeloppet om det är angivet, annars det
 * registrerade. Uppdelningen per person följer Kreditkortshanterarens
 * betalningsfördelning per faktura.
 */
export function getCreditCardAmountsForBudget(params: {
  budgetPeriod: string
  cards: CreditCard[]
  expenses: ExpenseWithCategory[]
  invoices: CardInvoice[]
  userId: string
  partnerId: string | null
  salaryDay: number
}) {
  const { budgetPeriod, cards, expenses, invoices, userId, partnerId, salaryDay } = params
  const grouped = groupExpensesByCardAndPeriod(expenses, cards)
  const parts: CreditCardBudgetPart[] = []

  cards.forEach(card => {
    const byPeriod = grouped.get(card.id) || new Map<string, ExpenseWithCategory[]>()
    const periods = new Set<string>(byPeriod.keys())
    invoices.filter(i => i.credit_card_id === card.id).forEach(i => periods.add(i.period))

    periods.forEach(invoicePeriod => {
      if (getInvoiceBudgetPeriod(invoicePeriod, card, salaryDay) !== budgetPeriod) return
      const periodExpenses = byPeriod.get(invoicePeriod) || []
      const invoice = invoices.find(i => i.credit_card_id === card.id && i.period === invoicePeriod)
      const invoiceAmount = Number(invoice?.actual_amount) || 0
      const amount = invoiceAmount > 0 ? invoiceAmount : sumCardExpenses(periodExpenses)
      if (amount <= 0) return

      const split = calculatePaymentSplit(periodExpenses, amount, userId, partnerId)
      parts.push({
        card,
        invoicePeriod,
        amount,
        source: invoiceAmount > 0 ? 'faktura' : 'registrerat',
        userAmount: split.userAmount,
        partnerAmount: split.partnerAmount,
      })
    })
  })

  const total = Math.round(parts.reduce((s, p) => s + p.amount, 0))
  const userAmount = Math.round(parts.reduce((s, p) => s + p.userAmount, 0))
  return {
    parts,
    total,
    userAmount,
    // Resten på partnern så att summan alltid stämmer exakt med totalen
    partnerAmount: total - userAmount,
  }
}
