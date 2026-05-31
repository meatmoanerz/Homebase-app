'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { motion } from 'framer-motion'
import { ArrowLeft, Wallet, Calculator, Info, Save, Check } from 'lucide-react'
import { useBudgets, useBudget } from '@/hooks/use-budgets'
import { useUser, usePartner } from '@/hooks/use-user'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatPeriodDisplay, getCurrentBudgetPeriod, getRecentPeriods } from '@/lib/utils/budget-period'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

// Local storage keys
const STORAGE_KEY = 'stacka-shared-account-categories'
const DEFAULT_CATEGORIES_KEY = 'stacka-shared-account-default-categories'

export default function SharedAccountPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: budgets } = useBudgets()

  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)
  const recentPeriods = getRecentPeriods(salaryDay, 6)

  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod.period)

  // Load default categories from localStorage
  const loadDefaultCategories = useCallback((): Set<string> => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = localStorage.getItem(DEFAULT_CATEGORIES_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return new Set(parsed)
        }
      }
    } catch (e) {
      console.error('Failed to load default categories:', e)
    }
    return new Set()
  }, [])

  // Initialize selectedCategories from localStorage (period-specific) or defaults
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      // First try to load period-specific saved categories
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return new Set(parsed)
        }
      }
      // If no period-specific, load defaults
      const defaults = localStorage.getItem(DEFAULT_CATEGORIES_KEY)
      if (defaults) {
        const parsed = JSON.parse(defaults)
        if (Array.isArray(parsed)) {
          return new Set(parsed)
        }
      }
    } catch (e) {
      console.error('Failed to load saved categories:', e)
    }
    return new Set()
  })

  // Save current selection as default
  const saveAsDefault = useCallback(() => {
    try {
      localStorage.setItem(DEFAULT_CATEGORIES_KEY, JSON.stringify(Array.from(selectedCategories)))
      toast.success('Kategorier sparade som standard')
    } catch (e) {
      console.error('Failed to save default categories:', e)
      toast.error('Kunde inte spara standardval')
    }
  }, [selectedCategories])

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

  // Combined list of all items for calculations
  const allItemsList = useMemo(() => {
    return [...allItems.fixed, ...allItems.variable, ...allItems.savings]
  }, [allItems])

  // Save selected categories to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedCategories)))
    } catch (e) {
      console.error('Failed to save categories:', e)
    }
  }, [selectedCategories])

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // Calculate totals using actual assignments when available
  const totals = useMemo(() => {
    const selectedItems = allItemsList.filter(item => selectedCategories.has(item.category_id || ''))
    const total = selectedItems.reduce((sum, item) => sum + item.amount, 0)

    let userTotal = 0
    let partnerTotal = 0

    selectedItems.forEach(item => {
      const assignment = item.budget_item_assignments?.find(a => a.user_id === user?.id)
      if (assignment) {
        userTotal += assignment.amount
        partnerTotal += item.amount - assignment.amount
      } else {
        userTotal += item.amount / 2
        partnerTotal += item.amount / 2
      }
    })

    return {
      total,
      userTotal,
      partnerTotal,
      selectedCount: selectedItems.length,
      items: selectedItems,
    }
  }, [allItemsList, selectedCategories, user?.id])

  const hasPartner = !!partner

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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-0 shadow-sm bg-hb-nav text-hb-nav-foreground">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-sm">Total summa</p>
                <p className="text-3xl font-bold">{formatCurrency(totals.total)}</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <Calculator className="w-7 h-7" />
              </div>
            </div>

            {hasPartner && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                <div>
                  <p className="text-white/70 text-xs">Du betalar</p>
                  <p className="text-xl font-semibold">{formatCurrency(totals.userTotal)}</p>
                </div>
                <div>
                  <p className="text-white/70 text-xs">{partner?.first_name || 'Partner'} betalar</p>
                  <p className="text-xl font-semibold">{formatCurrency(totals.partnerTotal)}</p>
                </div>
              </div>
            )}

            <p className="text-white/60 text-xs mt-4">
              {totals.selectedCount} kategorier valda
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Info Card */}
      {!hasPartner && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
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
      {allItemsList.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
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
                    setSelectedCategories(allIds)
                  }}
                >
                  Välj alla
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedCategories(new Set())}
                >
                  Avmarkera alla
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={saveAsDefault}
                >
                  <Save className="w-3.5 h-3.5" />
                  Spara som standard
                </Button>
              </div>

              {/* Fixed Expenses */}
              {allItems.fixed.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fasta kostnader</h4>
                  {allItems.fixed.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer",
                        selectedCategories.has(item.category_id || '')
                          ? "bg-hb-sage/30"
                          : "bg-muted/50 hover:bg-muted"
                      )}
                      onClick={() => toggleCategory(item.category_id || '')}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedCategories.has(item.category_id || '')}
                          onCheckedChange={() => toggleCategory(item.category_id || '')}
                        />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <span className="font-semibold text-sm">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Variable Expenses */}
              {allItems.variable.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rörliga kostnader</h4>
                  {allItems.variable.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer",
                        selectedCategories.has(item.category_id || '')
                          ? "bg-hb-sage/30"
                          : "bg-muted/50 hover:bg-muted"
                      )}
                      onClick={() => toggleCategory(item.category_id || '')}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedCategories.has(item.category_id || '')}
                          onCheckedChange={() => toggleCategory(item.category_id || '')}
                        />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <span className="font-semibold text-sm">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Savings */}
              {allItems.savings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sparande</h4>
                  {allItems.savings.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer",
                        selectedCategories.has(item.category_id || '')
                          ? "bg-hb-sage/30"
                          : "bg-muted/50 hover:bg-muted"
                      )}
                      onClick={() => toggleCategory(item.category_id || '')}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedCategories.has(item.category_id || '')}
                          onCheckedChange={() => toggleCategory(item.category_id || '')}
                        />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <span className="font-semibold text-sm">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Selected Items Summary */}
      {totals.selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 shadow-sm bg-hb-sage/10">
          <CardContent className="p-4">
            <h4 className="font-medium text-sm mb-2">Tips</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Valda kategorier sparas automatiskt</li>
              <li>• Beloppet baseras på din budget för vald period</li>
              <li>• Uppdatera budgeten för att ändra beloppen</li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
