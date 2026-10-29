'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useCreateSavingsWithdrawal } from '@/hooks/use-savings-goals'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { SavingsGoal } from '@/types'

interface SavingsWithdrawalDialogProps {
  goal: Pick<SavingsGoal, 'id' | 'user_id' | 'is_shared' | 'name'>
  saved: number
  /** Display names for the goal owner (user1) and the owner's partner (user2) */
  user1Name: string
  user2Name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SavingsWithdrawalDialog({ goal, saved, user1Name, user2Name, open, onOpenChange }: SavingsWithdrawalDialogProps) {
  const createWithdrawal = useCreateSavingsWithdrawal()
  const [amountDisplay, setAmountDisplay] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')
  const [from, setFrom] = useState<'both' | 'user1' | 'user2'>('both')

  const amount = parseInt(amountDisplay || '0', 10)
  const inputStyles = 'w-full h-11 px-4 rounded-xl bg-muted text-sm transition-colors focus:outline-none'

  const reset = () => {
    setAmountDisplay('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setNote('')
    setFrom('both')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!(amount > 0)) return
    try {
      await createWithdrawal.mutateAsync({ goal, amount, date, note: note.trim(), from: goal.is_shared ? from : 'user1' })
      toast.success(`Uttag på ${formatCurrency(amount)} registrerat`)
      reset()
      onOpenChange(false)
    } catch {
      toast.error('Kunde inte registrera uttaget')
    }
  }

  const options: { id: 'both' | 'user1' | 'user2'; label: string }[] = [
    { id: 'both', label: 'Båda lika' },
    { id: 'user1', label: user1Name },
    { id: 'user2', label: user2Name },
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gör uttag</DialogTitle>
          <DialogDescription>
            När pengar tas ut ur {goal.name}, till exempel för att betala resan. Det minskar det sparade, men räknas inte som en ny utgift.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl bg-hb-sage/20 py-5 px-6">
            <p className="text-muted-foreground text-xs text-center mb-2">Belopp</p>
            <div className="flex items-baseline justify-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                aria-label="Belopp"
                value={amountDisplay}
                onChange={(e) => setAmountDisplay(e.target.value.replace(/\D/g, ''))}
                className="text-4xl font-bold bg-transparent placeholder:text-muted-foreground/30 caret-hb-cognac tabular-nums text-right"
                style={{ outline: 'none', border: 'none', padding: 0, width: `${Math.max((amountDisplay || '0').length, 1) * 1.5}rem`, minWidth: '1.5rem', maxWidth: '12rem' }}
                autoFocus
              />
              <span className="text-xl text-muted-foreground font-medium shrink-0">kr</span>
            </div>
            {amount > saved && (
              <p className="text-xs text-center mt-2 text-amber-700 dark:text-amber-300">
                Mer än det sparade ({formatCurrency(saved)})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Datum</Label>
            <div className="relative">
              <div className={cn(inputStyles, 'flex items-center pointer-events-none')}>
                {format(new Date(date), 'd MMMM yyyy', { locale: sv })}
              </div>
              {/* Transparent overlay: showPicker() fails silently in Safari */}
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Datum"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="withdrawal-note" className="text-muted-foreground text-sm">Notering (valfritt)</Label>
            <input
              id="withdrawal-note"
              placeholder="T.ex. Flyg till Bangkok"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={cn(inputStyles, 'placeholder:text-muted-foreground/50')}
            />
          </div>

          {goal.is_shared && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Tas från</Label>
              <div className="flex gap-1 p-1 bg-muted rounded-xl">
                {options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={from === o.id}
                    onClick={() => setFrom(o.id)}
                    className={cn(
                      'flex-1 min-h-10 rounded-lg text-sm font-medium transition-all',
                      from === o.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={!(amount > 0) || createWithdrawal.isPending}>
            {createWithdrawal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrera uttag'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
