'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsPageSkeleton } from '@/components/shared/page-skeletons'
import { useUser } from '@/hooks/use-user'
import { useCategoriesByType } from '@/hooks/use-categories'
import { useBudgetByPeriod } from '@/hooks/use-budgets'
import { useHouseholdEconomy, useSaveHouseholdSettings } from '@/hooks/use-household-economy'
import { formatShare } from '@/lib/household/economy'
import { formatPeriodDisplay, getCurrentBudgetPeriod, getNextPeriods } from '@/lib/utils/budget-period'
import { cn } from '@/lib/utils/cn'
import type { Category } from '@/types'

type CostMode = 'none' | 'budget' | 'income'

export default function SharedCostsPage() {
  const { data: user, isLoading } = useUser()
  if (isLoading || !user) return <SettingsPageSkeleton />
  return <SharedCostsView salaryDay={user.salary_day || 25} />
}

function SharedCostsView({ salaryDay }: { salaryDay: number }) {
  const router = useRouter()
  const currentPeriod = getCurrentBudgetPeriod(salaryDay).period
  const periods = getNextPeriods(salaryDay, 4)
  const [period, setPeriod] = useState(currentPeriod)

  const { fixed, variable, savings, isLoading: categoriesLoading } = useCategoriesByType()
  const { settings, incomeSplit, isLoading } = useHouseholdEconomy(period)
  const { data: budget } = useBudgetByPeriod(period)
  const save = useSaveHouseholdSettings()
  const byIncome = settings.model === 'income'

  // Saved modes for the period, before any edits
  const savedModes = useMemo(() => {
    const modes = new Map<string, CostMode>()
    settings.categoryIds.forEach((id) => modes.set(id, byIncome && settings.incomeCategoryIds.has(id) ? 'income' : 'budget'))
    return modes
  }, [settings, byIncome])

  // First time in "Efter inkomst": suggest income for shared categories without
  // their own split in the budget (like the credit card, which follows purchases)
  const suggestion = useMemo(() => {
    if (!byIncome || settings.incomeCategoryIds.size > 0 || settings.categoryIds.size === 0) return null
    const ownSplit = new Set(
      (budget?.budget_items ?? [])
        .filter((item) => (item.budget_item_assignments ?? []).length > 0 && item.category_id)
        .map((item) => item.category_id as string)
    )
    const modes = new Map<string, CostMode>()
    settings.categoryIds.forEach((id) => modes.set(id, ownSplit.has(id) ? 'budget' : 'income'))
    return modes
  }, [byIncome, settings, budget])

  // Local edits, keyed by period so switching period starts from that period's settings
  const [edits, setEdits] = useState<{ period: string; modes: Map<string, CostMode> } | null>(null)
  const modes = edits?.period === period ? edits.modes : (suggestion ?? savedModes)
  const dirty = (edits?.period === period) || !!suggestion

  const setMode = (categoryId: string, mode: CostMode) => {
    const next = new Map(modes)
    if (mode === 'none') next.delete(categoryId)
    else next.set(categoryId, mode)
    setEdits({ period, modes: next })
  }

  const handleSave = () => {
    const categoryIds = Array.from(modes.keys())
    const incomeCategoryIds = categoryIds.filter((id) => modes.get(id) === 'income')
    save.mutate(
      {
        period,
        current: settings,
        categoryIds,
        // Outside "Efter inkomst" the income column is hidden: keep what was saved
        incomeCategoryIds: byIncome ? incomeCategoryIds : Array.from(settings.incomeCategoryIds),
        successMessage: `Sparat — gäller från ${formatPeriodDisplay(period)}`,
      },
      { onSuccess: () => setEdits(null) }
    )
  }

  const options: { id: CostMode; label: string }[] = byIncome
    ? [{ id: 'none', label: 'Nej' }, { id: 'budget', label: 'Budget' }, { id: 'income', label: 'Inkomst' }]
    : [{ id: 'none', label: 'Nej' }, { id: 'budget', label: 'Ja' }]

  const groups: { title: string; items: Category[] }[] = [
    { title: 'Fasta kostnader', items: fixed },
    { title: 'Rörliga kostnader', items: variable },
    { title: 'Sparande', items: savings },
  ]

  if (categoriesLoading || isLoading) return <SettingsPageSkeleton />

  return (
    <div className="p-4 space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="hidden md:flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Tillbaka">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-hb-cognac">Gemensamma kostnader</h1>
          <p className="text-sm text-muted-foreground">Det som betalas från gemensamma kontot</p>
        </div>
      </motion.div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted-foreground">Gäller från</span>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-auto min-w-40 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.period} value={p.period}>
                    <span className="capitalize">{formatPeriodDisplay(p.period)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2.5 text-[13px] leading-snug text-muted-foreground pt-3 border-t border-border">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            {byIncome ? (
              <p>
                <strong className="text-foreground font-medium">Budget</strong>: delas som i budgeten.{' '}
                <strong className="text-foreground font-medium">Inkomst</strong>: delas efter er procentsats
                {incomeSplit.bothRegistered ? ` (${formatShare(incomeSplit.userShare)} i ${formatPeriodDisplay(period).split(' ')[0]})` : ''}.
              </p>
            ) : (
              <p>Välj vad som betalas från gemensamma kontot. Varje kostnad delas så som den står i budgeten.</p>
            )}
          </div>
          {suggestion && !edits && (
            <p className="text-[13px] rounded-lg bg-muted px-3 py-2">
              Förslag: kostnader utan egen fördelning i budgeten delas efter inkomst. Ändra och spara.
            </p>
          )}
        </CardContent>
      </Card>

      {groups.map((group) => group.items.length > 0 && (
        <Card key={group.title} className="border-0 shadow-sm">
          <CardContent className="p-0">
            <h2 className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">{group.title}</h2>
            {group.items.map((cat) => {
              const mode = modes.get(cat.id) ?? 'none'
              const shown = !byIncome && mode === 'income' ? 'budget' : mode
              return (
                <div key={cat.id} className="flex items-center gap-3 min-h-14 px-4 border-t border-border first-of-type:border-t-0">
                  <span className={cn('flex-1 min-w-0 truncate', shown === 'none' && 'text-muted-foreground')}>{cat.name}</span>
                  <div role="radiogroup" aria-label={`${cat.name}: gemensam kostnad`} className="flex p-0.5 rounded-lg bg-muted shrink-0">
                    {options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={shown === o.id}
                        onClick={() => setMode(cat.id, o.id)}
                        className={cn(
                          'min-h-9 px-2.5 rounded-md text-xs font-semibold transition-colors',
                          shown === o.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      {dirty && (
        // Sticks above the floating bottom nav on phones
        <div className="sticky z-40 bottom-[calc(env(safe-area-inset-bottom,0px)+92px)] md:bottom-4">
          <div className="flex gap-2 p-2 rounded-2xl bg-card shadow-lg">
            {edits && (
              <Button variant="outline" className="h-12" onClick={() => setEdits(null)} disabled={save.isPending}>
                Ångra
              </Button>
            )}
            <Button className="flex-1 h-12" onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Spara · gäller från ${formatPeriodDisplay(period)}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
