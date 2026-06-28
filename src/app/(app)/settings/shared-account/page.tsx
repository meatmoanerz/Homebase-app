'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { motion } from 'framer-motion'
import { ArrowLeft, Wallet, Calculator, Info, Save } from 'lucide-react'
import { useBudgets, useBudget } from '@/hooks/use-budgets'
import { useCategories } from '@/hooks/use-categories'
import { useUser, usePartner } from '@/hooks/use-user'
import {
  useSharedAccountDefaults,
  resolveDefaultForPeriod,
  useSaveSharedAccountDefault,
} from '@/hooks/use-shared-account-defaults'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatPeriodDisplay, getCurrentBudgetPeriod, getRecentPeriods } from '@/lib/utils/budget-period'
import { cn } from '@/lib/utils/cn'

export default function SharedAccountPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: budgets } = useBudgets()
  const { data: categories = [] } = useCategories()
  const { data: defaults = [] } = useSharedAccountDefaults()
  const saveDefault = useSaveSharedAccountDefault()

  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)
  const recentPeriods = getRecentPeriods(salaryDay, 6)

  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod.period)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())

  // The active default (effective-dated) for the viewed period
  const activeDefault = useMemo(
    () => resolveDefaultForPeriod(defaults, selectedPeriod),
    [defaults, selectedPeriod]
  )

  // Reset the working selection from the active default whenever the viewed
  // period (or the resolved default for it) changes. Render-time "reset state
  // when a value changes" pattern instead of an effect.
  const defaultKey = useMemo(
    () => `${selectedPeriod}|${Array.from(activeDefault.categoryIds).sort().join(',')}`,
    [selectedPeriod, activeDefault.categoryIds]
  )
  const [initializedKey, setInitializedKey] = useState<string | null>(null)
  if (initializedKey !== defaultKey) {
    setInitializedKey(defaultKey)
    setSelectedCategories(new Set(activeDefault.categoryIds))
  }

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )

  // Save current selection as the new household default, effective from this period
  const saveAsDefault = () => {
    saveDefault.mutate({ period: selectedPeriod, categoryIds: Array.from(selectedCategories) })
  }

  // Find budget for selected period
  const selectedBudget = budgets?.find(b => b.period === selectedPeriod)
  const { data: budgetDetails } = useBudget(selectedBudget?.id || '')

  // Get all expense items from budget (fixed, variable, savings)
  const allItems = useMemo(() => {
    if (!budgetDetails?.budget_items) return { fixed: [], variable: [], savings: [] }
    return {
      fixed: budgetDetails.budget_items.filter(item => item.type === 'fixedExpense'),
      variable: budgetDetails.budget_items.filter(item => item.type === 'variableExpense'),
      savings: budgetDetails.budget_items.filter(item => item.type === 'savings'),
    }
  }, [budgetDetails])

  const allItemsList = useMemo(() => {
    return [...allItems.fixed, ...allItems.variable, ...allItems.savings]
  }, [allItems])

  // Default categories that have NO budget item this period — show them at 0 kr so
  // you can see if a category that's normally shared wasn't budgeted this month.
  const unbudgetedDefaults = useMemo(() => {
    const budgetedIds = new Set(allItemsList.map(i => i.category_id || ''))
    return Array.from(activeDefault.categoryIds)
      .filter(id => id && !budgetedIds.has(id))
      .map(id => ({ id, name: categoryById.get(id)?.name || 'Okänd kategori' }))
  }, [activeDefault.categoryIds, allItemsList, categoryById])

  const toggleCategory = (categoryId: string) => {
    if (!categoryId) return
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  // Totals — per person from explicit budget_item_assignments, robust fallback.
  const totals = useMemo(() => {
    const selectedItems = allItemsList.filter(item => selectedCategories.has(item.category_id || ''))
    const total = selectedItems.reduce((sum, item) => sum + item.amount, 0)

    let userTotal = 0
    let partnerTotal = 0

    selectedItems.forEach(item => {
      const userAssign = item.budget_item_assignments?.find(a => a.user_id === user?.id)
      const partnerAssign = item.budget_item_assignments?.find(a => a.user_id === partner?.id)

      if (userAssign || partnerAssign) {
        const u = userAssign?.amount ?? (item.amount - (partnerAssign?.amount ?? 0))
        const p = partnerAssign?.amount ?? (item.amount - (userAssign?.amount ?? 0))
        userTotal += u
        partnerTotal += p
      } else {
        userTotal += item.amount / 2
        partnerTotal += item.amount / 2
      }
    })

    return { total, userTotal, partnerTotal, selectedCount: selectedItems.length, items: selectedItems }
  }, [allItemsList, selectedCategories, user?.id, partner?.id])

  const hasPartner = !!partner

  const renderCategoryRow = (id: string, name: string, amount: number, dimmed = false) => (
    <div
      key={id}
      className={cn(
        'flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer',
        selectedCategories.has(id) ? 'bg-hb-sage/30' : 'bg-muted/50 hover:bg-muted',
        dimmed && 'opacity-80'
      )}
      onClick={() => toggleCategory(id)}
    >
      <div className="flex items-center gap-3">
        <Checkbox checked={selectedCategories.has(id)} onCheckedChange={() => toggleCategory(id)} />
        <span className="font-medium text-sm">{name}</span>
      </div>
      <span className={cn('font-semibold text-sm', amount === 0 && 'text-muted-foreground')}>
        {formatCurrency(amount)}
      </span>
    </div>
  )

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-hb-cognac">Gemensamt konto</h1>
          <p className="text-sm text-muted-foreground">Beräkna överföring till gemensamt konto</p>
        </div>
      </motion.div>

      {/* Period Selector */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Välj period" />
          </SelectTrigger>
          <SelectContent>
            {recentPeriods.map(period => (
              <SelectItem key={period.period} value={period.period}>
                <span className="capitalize">{formatPeriodDisplay(period.period)}</span>
                {period.period === currentPeriod.period && (
                  <span className="ml-2 text-xs text-hb-cognac">(Aktuell)</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Summary Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-0 shadow-sm bg-hb-nav text-hb-nav-foreground">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-hb-nav-foreground/70 text-sm">Total summa</p>
                <p className="text-3xl font-bold text-hb-nav-foreground">{formatCurrency(totals.total)}</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-hb-nav-foreground/15 flex items-center justify-center">
                <Calculator className="w-7 h-7" />
              </div>
            </div>

            {hasPartner && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-hb-nav-foreground/20">
                <div>
                  <p className="text-hb-nav-foreground/70 text-xs">Du betalar</p>
                  <p className="text-xl font-semibold text-hb-nav-foreground">{formatCurrency(totals.userTotal)}</p>
                </div>
                <div>
                  <p className="text-hb-nav-foreground/70 text-xs">{partner?.first_name || 'Partner'} betalar</p>
                  <p className="text-xl font-semibold text-hb-nav-foreground">{formatCurrency(totals.partnerTotal)}</p>
                </div>
              </div>
            )}

            <p className="text-hb-nav-foreground/60 text-xs mt-4">
              {totals.selectedCount} kategorier valda
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Info Card */}
      {!hasPartner && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-0 shadow-sm bg-hb-sage/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-hb-cognac shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Koppla en partner för att automatiskt beräkna uppdelning av gemensamma kostnader baserat på budgetens fördelning.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* No Budget Warning */}
      {!selectedBudget && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Ingen budget finns för {formatPeriodDisplay(selectedPeriod)}.
              </p>
              <Button
                variant="link"
                className="text-amber-700 dark:text-amber-300 p-0 h-auto mt-1"
                onClick={() => router.push(`/budget/new?period=${selectedPeriod}`)}
              >
                Skapa budget
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Categories Selection */}
      {(allItemsList.length > 0 || unbudgetedDefaults.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-hb-cognac" />
                Kategorier
              </CardTitle>
              <CardDescription className="text-xs">
                Välj vilka kategorier som ska ingå i gemensamma kontot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const allIds = new Set(allItemsList.map(item => item.category_id || '').filter(Boolean))
                    unbudgetedDefaults.forEach(d => allIds.add(d.id))
                    setSelectedCategories(allIds)
                  }}
                >
                  Välj alla
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedCategories(new Set())}>
                  Avmarkera alla
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={saveAsDefault}
                  disabled={saveDefault.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  Spara som standard
                </Button>
              </div>

              {/* Fixed Expenses */}
              {allItems.fixed.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fasta kostnader</h4>
                  {allItems.fixed.map(item => renderCategoryRow(item.category_id || '', item.name, item.amount))}
                </div>
              )}

              {/* Variable Expenses */}
              {allItems.variable.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rörliga kostnader</h4>
                  {allItems.variable.map(item => renderCategoryRow(item.category_id || '', item.name, item.amount))}
                </div>
              )}

              {/* Savings */}
              {allItems.savings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sparande</h4>
                  {allItems.savings.map(item => renderCategoryRow(item.category_id || '', item.name, item.amount))}
                </div>
              )}

              {/* Standard categories with no budget this period */}
              {unbudgetedDefaults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-hb-amber uppercase tracking-wider">Standard — ej budgeterad denna period</h4>
                  {unbudgetedDefaults.map(d => renderCategoryRow(d.id, d.name, 0, true))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Selected Items Summary */}
      {totals.selectedCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sammanfattning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {totals.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
                <span className="font-semibold">Totalt</span>
                <span className="font-bold text-lg">{formatCurrency(totals.total)}</span>
              </div>
              {hasPartner && (
                <>
                  <div className="flex items-center justify-between text-sm text-hb-cognac">
                    <span>Du betalar</span>
                    <span className="font-semibold">{formatCurrency(totals.userTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-hb-cognac">
                    <span>{partner?.first_name || 'Partner'} betalar</span>
                    <span className="font-semibold">{formatCurrency(totals.partnerTotal)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tips */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-0 shadow-sm bg-hb-sage/10">
          <CardContent className="p-4">
            <h4 className="font-medium text-sm mb-2">Tips</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• &quot;Spara som standard&quot; gäller från vald period och framåt — historiken bakåt är orörd</li>
              <li>• Belopp per person baseras på budgetens fördelning (Tim/Amanda)</li>
              <li>• Uppdatera budgeten för att ändra beloppen</li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
