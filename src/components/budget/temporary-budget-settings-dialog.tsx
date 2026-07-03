'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  useUpdateTemporaryBudget,
  useArchiveTemporaryBudget,
  useCompleteTemporaryBudget,
  useDeleteTemporaryBudget,
} from '@/hooks/use-temporary-budgets'
import { useCategories } from '@/hooks/use-categories'
import { CURRENCIES, getCurrency } from '@/lib/utils/currencies'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2, Archive, CheckCircle2, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TemporaryBudgetWithDetails } from '@/types'
import { AnimatePresence, motion } from 'framer-motion'

interface TemporaryBudgetSettingsDialogProps {
  budget: TemporaryBudgetWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemporaryBudgetSettingsDialog({
  budget,
  open,
  onOpenChange,
}: TemporaryBudgetSettingsDialogProps) {
  const router = useRouter()
  const updateBudget = useUpdateTemporaryBudget()
  const archiveBudget = useArchiveTemporaryBudget()
  const completeBudget = useCompleteTemporaryBudget()
  const deleteBudget = useDeleteTemporaryBudget()
  const { data: monthlyCategories } = useCategories()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)

  const [currency, setCurrency] = useState(budget.currency)
  const [exchangeRate, setExchangeRate] = useState(budget.exchange_rate)
  const [linkedPeriod, setLinkedPeriod] = useState(budget.linked_budget_period)
  const [linkedCategoryId, setLinkedCategoryId] = useState(budget.linked_category_id)

  const currencyInfo = getCurrency(currency)
  const isNonSEK = currency !== 'SEK'

  const handleCurrencyChange = (code: string) => {
    setCurrency(code)
    const c = getCurrency(code)
    if (c) setExchangeRate(c.defaultRate)
    setCurrencyOpen(false)
  }

  async function handleSave() {
    try {
      await updateBudget.mutateAsync({
        id: budget.id,
        currency,
        exchange_rate: exchangeRate,
        linked_budget_period: linkedPeriod,
        linked_category_id: linkedPeriod ? linkedCategoryId : null,
      })
      toast.success('Inställningar sparade')
      onOpenChange(false)
    } catch {
      toast.error('Kunde inte spara inställningar')
    }
  }

  async function handleComplete() {
    try {
      await completeBudget.mutateAsync(budget.id)
      toast.success('Projektbudget markerad som klar')
      onOpenChange(false)
    } catch {
      toast.error('Kunde inte markera som klar')
    }
  }

  async function handleArchive() {
    try {
      await archiveBudget.mutateAsync(budget.id)
      toast.success('Projektbudget arkiverad')
      onOpenChange(false)
      router.push('/budget')
    } catch {
      toast.error('Kunde inte arkivera')
    }
  }

  async function handleDelete() {
    try {
      await deleteBudget.mutateAsync(budget.id)
      toast.success('Projektbudget borttagen')
      setDeleteDialogOpen(false)
      onOpenChange(false)
      router.push('/budget')
    } catch {
      toast.error('Kunde inte ta bort projektbudget')
    }
  }

  const inputStyles =
    'w-full h-11 px-4 rounded-xl bg-muted text-sm transition-colors focus:outline-none focus:ring-0 focus:border-0'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inställningar</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Currency */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Valuta</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCurrencyOpen(!currencyOpen)}
                  className={cn(inputStyles, 'flex items-center justify-between cursor-pointer text-left')}
                >
                  <span>
                    {currencyInfo ? `${currencyInfo.code} — ${currencyInfo.name}` : 'Välj valuta'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform',
                      currencyOpen && 'rotate-180'
                    )}
                  />
                </button>
                <AnimatePresence>
                  {currencyOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-48 overflow-y-auto"
                    >
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleCurrencyChange(c.code)}
                          className="w-full px-4 py-2.5 text-left hover:bg-muted/50 flex items-center justify-between transition-colors text-sm"
                        >
                          <span>
                            {c.symbol} {c.code}
                          </span>
                          {currency === c.code && <Check className="w-4 h-4 text-hb-cognac" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Exchange Rate */}
            {isNonSEK && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">
                  Växelkurs (1 {currency} = X SEK)
                </Label>
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                  className={inputStyles}
                  style={{ outline: 'none', boxShadow: 'none' }}
                />
              </div>
            )}

            {/* Monthly Budget Link */}
            <div className="space-y-3 p-3 rounded-xl bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Koppla till månadsbudget</Label>
                  <p className="text-xs text-muted-foreground">Allokera från månadsbudget</p>
                </div>
                <Switch
                  checked={!!linkedPeriod}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      setLinkedPeriod(null)
                      setLinkedCategoryId(null)
                    } else {
                      const now = new Date()
                      setLinkedPeriod(
                        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                      )
                    }
                  }}
                />
              </div>

              {/* Category dropdown when linked */}
              {!!linkedPeriod && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Budgetkategori</Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                      className={cn(inputStyles, 'flex items-center justify-between cursor-pointer text-left')}
                    >
                      <span className={!linkedCategoryId ? 'text-muted-foreground/50' : ''}>
                        {linkedCategoryId
                          ? monthlyCategories?.find((c) => c.id === linkedCategoryId)?.name || 'Välj kategori'
                          : 'Välj kategori'}
                      </span>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 text-muted-foreground transition-transform',
                          categoryDropdownOpen && 'rotate-180'
                        )}
                      />
                    </button>

                    <AnimatePresence>
                      {categoryDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-48 overflow-y-auto"
                        >
                          {monthlyCategories?.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setLinkedCategoryId(cat.id)
                                setCategoryDropdownOpen(false)
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-muted/50 flex items-center justify-between transition-colors text-sm"
                            >
                              <span>{cat.name}</span>
                              {linkedCategoryId === cat.id && (
                                <Check className="w-4 h-4 text-hb-cognac" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {budget.status === 'active' && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={handleComplete}
                  disabled={completeBudget.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Markera som klar
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleArchive}
                disabled={archiveBudget.isPending}
              >
                <Archive className="w-4 h-4" />
                Arkivera
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
                Ta bort
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSave}
              className="w-full bg-hb-cognac hover:bg-hb-cognac/90"
              disabled={updateBudget.isPending}
            >
              {updateBudget.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Spara inställningar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort projektbudget?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker? Projektbudgeten tas bort men utgifterna finns kvar (utan koppling till
              projektet).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBudget.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ta bort'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
