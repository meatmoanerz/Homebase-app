'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Loader2, PiggyBank, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  useSavingsGoals,
  getSavedAmount,
  useExpenseFunding,
  useFundExpenseFromSavings,
  useRemoveExpenseFunding,
} from '@/hooks/use-savings-goals'
import { useCreditCards } from '@/hooks/use-credit-cards'
import { useUser, usePartner } from '@/hooks/use-user'
import { getCardInvoicePeriod, formatDueDate, resolveExpenseCardId, type CreditCard } from '@/lib/utils/credit-cards'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { ExpenseWithCategory } from '@/types'

/**
 * When the money moves from the savings account to the account that pays:
 * a card purchase is paid when the invoice is drawn, anything else right away.
 */
function defaultFundingDate(expense: ExpenseWithCategory, cards: CreditCard[]): string {
  if (!expense.is_ccm) return expense.date
  const cardId = resolveExpenseCardId(expense, cards)
  const card = cards.find((c) => c.id === cardId)
  if (!card) return expense.date
  return formatDueDate(getCardInvoicePeriod(expense.date, card), card)
}

function shortDate(date: string): string {
  return format(new Date(`${date}T00:00:00`), 'd MMM yyyy', { locale: sv })
}

/**
 * "Betala med sparande" on an expense: the part paid from a savings goal is
 * left out of the budget outcome (it was counted when it was saved) and comes
 * in as cash on the date the money moves.
 */
export function SavingsFundingSection({ expense }: { expense: ExpenseWithCategory }) {
  const { data: fundings = [] } = useExpenseFunding(expense.id)
  const removeFunding = useRemoveExpenseFunding()
  const [dialogOpen, setDialogOpen] = useState(false)

  const funded = fundings.reduce((sum, f) => sum + f.amount, 0)
  const remaining = Math.max(0, Math.round((expense.amount - funded) * 100) / 100)

  if (expense.amount <= 0) return null

  return (
    <div className="rounded-xl bg-muted/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <PiggyBank className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium">Betala med sparande</div>
            <div className="text-[11px] text-muted-foreground">
              {funded > 0
                ? `${formatCurrency(funded)} från sparande · ${formatCurrency(remaining)} räknas i budgeten`
                : 'Pengar ni redan sparat räknas inte en gång till'}
            </div>
          </div>
        </div>
        {remaining > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            {funded > 0 ? 'Mer' : 'Välj sparmål'}
          </Button>
        )}
      </div>

      {fundings.length > 0 && (
        <ul className="space-y-1">
          {fundings.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                {f.goal_name} · {formatCurrency(f.amount)} · flyttas {shortDate(f.date)}
              </span>
              <button
                type="button"
                aria-label={`Ta bort ${formatCurrency(f.amount)} från ${f.goal_name}`}
                className="w-6 h-6 grid place-items-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-40"
                disabled={removeFunding.isPending}
                onClick={async () => {
                  try {
                    await removeFunding.mutateAsync(f.id)
                    toast.success(`${formatCurrency(f.amount)} tillbaka i ${f.goal_name}`)
                  } catch {
                    toast.error('Kunde inte ta bort')
                  }
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <FundFromSavingsDialog
        expense={expense}
        maxAmount={remaining}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}

function FundFromSavingsDialog({
  expense, maxAmount, open, onOpenChange,
}: {
  expense: ExpenseWithCategory
  maxAmount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: goals = [] } = useSavingsGoals()
  const { data: cards = [] } = useCreditCards()
  const fund = useFundExpenseFromSavings()

  const available = useMemo(
    () => goals.filter((g) => getSavedAmount(g) > 0),
    [goals]
  )
  const [goalId, setGoalId] = useState<string | null>(null)
  const goal = available.find((g) => g.id === goalId) ?? null
  const saved = goal ? getSavedAmount(goal) : 0
  const suggested = goal ? Math.min(saved, maxAmount) : 0
  const [amountDisplay, setAmountDisplay] = useState('')
  const [date, setDate] = useState(expense.date)
  const [dateTouched, setDateTouched] = useState(false)
  const [from, setFrom] = useState<'both' | 'user1' | 'user2'>('both')

  const amount = amountDisplay === '' ? suggested : Number(amountDisplay.replace(',', '.'))
  const fundingDate = dateTouched ? date : defaultFundingDate(expense, cards as CreditCard[])
  const valid = !!goal && amount > 0 && amount <= maxAmount + 0.005 && amount <= saved + 0.005

  const ownerIsMe = goal?.user_id === user?.id
  const user1Name = (ownerIsMe ? user?.first_name : partner?.first_name) || 'Ägaren'
  const user2Name = (ownerIsMe ? partner?.first_name : user?.first_name) || 'Partner'

  function reset() {
    setGoalId(null)
    setAmountDisplay('')
    setDateTouched(false)
    setFrom('both')
  }

  async function submit() {
    if (!goal || !valid) return
    try {
      await fund.mutateAsync({
        expenseId: expense.id,
        goal,
        amount,
        date: fundingDate,
        from: goal.is_shared ? from : 'user1',
        note: expense.description,
      })
      toast.success(`${formatCurrency(amount)} betalas från ${goal.name}`, {
        description: 'Räknas inte i budgeten, och kommer in i kassaflödet när pengarna flyttas.',
      })
      reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Kunde inte betala med sparande:', error)
      toast.error('Kunde inte spara', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const inputStyles = 'w-full h-11 px-4 rounded-xl bg-muted text-sm focus:outline-none'

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Betala med sparande</DialogTitle>
          <DialogDescription>
            {expense.description} · {formatCurrency(expense.amount)}. Delen som betalas med sparade
            pengar räknas inte i budgeten, eftersom den redan räknades när ni sparade.
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga sparmål med pengar i.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sparmål</Label>
              <div className="space-y-1.5">
                {available.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { setGoalId(g.id); setAmountDisplay('') }}
                    className={cn(
                      'w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm border transition-colors',
                      goalId === g.id ? 'border-stacka-olive bg-stacka-olive/10' : 'border-border hover:bg-muted'
                    )}
                  >
                    <span className="truncate">{g.name}</span>
                    <span className="text-muted-foreground shrink-0">{formatCurrency(getSavedAmount(g))}</span>
                  </button>
                ))}
              </div>
            </div>

            {goal && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="funding-amount">Belopp</Label>
                  <input
                    id="funding-amount"
                    type="text"
                    inputMode="decimal"
                    value={amountDisplay === '' ? String(suggested) : amountDisplay}
                    onChange={(e) => setAmountDisplay(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className={inputStyles}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Högst {formatCurrency(Math.min(saved, maxAmount))}
                    {saved < maxAmount && ` — resten, ${formatCurrency(maxAmount - saved)}, räknas i budgeten`}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="funding-date">Pengarna flyttas</Label>
                  <input
                    id="funding-date"
                    type="date"
                    value={fundingDate}
                    onChange={(e) => { setDate(e.target.value); setDateTouched(true) }}
                    className={inputStyles}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {expense.is_ccm
                      ? 'Kortköp: när kortfakturan dras. Då kommer pengarna in i kassaflödet.'
                      : 'Då kommer pengarna in i kassaflödet.'}
                  </p>
                </div>

                {goal.is_shared && (
                  <div className="space-y-1.5">
                    <Label>Tas från</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { id: 'both', label: 'Båda lika' },
                        { id: 'user1', label: user1Name },
                        { id: 'user2', label: user2Name },
                      ] as const).map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setFrom(o.id)}
                          className={cn(
                            'rounded-full px-2 py-1.5 text-xs border truncate',
                            from === o.id ? 'border-stacka-olive bg-stacka-olive/10 font-medium' : 'border-border'
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <Button type="button" className="w-full" disabled={!valid || fund.isPending} onClick={submit}>
              {fund.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {goal && amount > 0 ? `Betala ${formatCurrency(amount)} från ${goal.name}` : 'Välj sparmål'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
