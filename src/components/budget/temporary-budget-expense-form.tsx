'use client'

import { useState, useRef, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateExpense } from '@/hooks/use-expenses'
import { useUpdateTemporaryBudgetSpent } from '@/hooks/use-temporary-budgets'
import { useUser, usePartner } from '@/hooks/use-user'
import { useCategoriesByType } from '@/hooks/use-categories'
import { convertToSEK, getCurrency, formatCurrencyAmount } from '@/lib/utils/currencies'
import { formatCurrency } from '@/lib/utils/formatters'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Loader2, ChevronDown, Check, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TemporaryBudgetWithDetails } from '@/types'

interface TemporaryBudgetExpenseFormProps {
  budget: TemporaryBudgetWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemporaryBudgetExpenseForm({
  budget,
  open,
  onOpenChange,
}: TemporaryBudgetExpenseFormProps) {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { fixed, variable, savings } = useCategoriesByType()
  const createExpense = useCreateExpense()
  const updateSpent = useUpdateTemporaryBudgetSpent()
  const hasPartner = !!partner
  const isCCMEnabled = user?.ccm_enabled || false

  const isNonSEK = budget.currency !== 'SEK'
  const currencyInfo = getCurrency(budget.currency)

  const [amountDisplay, setAmountDisplay] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedProjectCategoryId, setSelectedProjectCategoryId] = useState<string | null>(null)
  const [selectedRegularCategoryId, setSelectedRegularCategoryId] = useState('')
  const [projectCatOpen, setProjectCatOpen] = useState(false)
  const [regularCatOpen, setRegularCatOpen] = useState(false)
  const [regularCatSearch, setRegularCatSearch] = useState('')
  const [costAssignment, setCostAssignment] = useState<'personal' | 'shared' | 'partner'>('shared')
  const [isCCM, setIsCCM] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const regularCatInputRef = useRef<HTMLInputElement>(null)

  const allRegularCategories = useMemo(
    () => [...variable, ...fixed, ...savings],
    [variable, fixed, savings]
  )

  const selectedRegularCategory = allRegularCategories.find((c) => c.id === selectedRegularCategoryId)

  const filteredRegularCategories = useMemo(() => {
    if (!regularCatSearch) return { variable, fixed, savings }
    const search = regularCatSearch.toLowerCase()
    return {
      variable: variable.filter((c) => c.name.toLowerCase().includes(search)),
      fixed: fixed.filter((c) => c.name.toLowerCase().includes(search)),
      savings: savings.filter((c) => c.name.toLowerCase().includes(search)),
    }
  }, [regularCatSearch, variable, fixed, savings])

  const hasFilteredResults =
    filteredRegularCategories.variable.length > 0 ||
    filteredRegularCategories.fixed.length > 0 ||
    filteredRegularCategories.savings.length > 0

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '') {
      setAmountDisplay('')
      return
    }
    const numValue = parseInt(value.replace(/\D/g, ''), 10)
    if (!isNaN(numValue)) {
      setAmountDisplay(numValue.toString())
    }
  }

  const formatDisplayDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMMM yyyy', { locale: sv })
    } catch {
      return dateStr
    }
  }

  function resetForm() {
    setAmountDisplay('')
    setDescription('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setSelectedProjectCategoryId(null)
    setSelectedRegularCategoryId('')
    setCostAssignment('shared')
    setIsCCM(false)
    setProjectCatOpen(false)
    setRegularCatOpen(false)
    setRegularCatSearch('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const rawAmount = parseInt(amountDisplay, 10)
    if (!rawAmount || rawAmount <= 0) {
      toast.error('Ange ett belopp')
      return
    }
    if (!description.trim()) {
      toast.error('Ange en beskrivning')
      return
    }
    const effectiveCategoryId = budget.linked_category_id || selectedRegularCategoryId
    if (!effectiveCategoryId) {
      toast.error('Välj en kategori')
      return
    }

    // Convert from project currency to SEK if needed
    const amountSEK = isNonSEK ? convertToSEK(rawAmount, budget.exchange_rate) : rawAmount

    try {
      await createExpense.mutateAsync({
        user_id: user?.id || '',
        amount: amountSEK,
        description: description.trim(),
        category_id: effectiveCategoryId,
        date,
        cost_assignment: costAssignment,
        is_ccm: isCCM,
        temporary_budget_id: budget.id,
        temporary_budget_category_id: selectedProjectCategoryId,
        original_currency: isNonSEK ? budget.currency : null,
        original_amount: isNonSEK ? rawAmount : null,
      })

      // Update total_spent cache on the budget
      await updateSpent.mutateAsync(budget.id)

      toast.success('Utgift tillagd')
      resetForm()
      onOpenChange(false)
    } catch {
      toast.error('Kunde inte lägga till utgift')
    }
  }

  const inputStyles =
    'w-full h-11 px-4 rounded-xl bg-muted text-sm transition-colors focus:outline-none focus:ring-0 focus:border-0'

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ny utgift — {budget.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div className="rounded-xl bg-hb-sand/20 py-5 px-6">
            <p className="text-muted-foreground text-xs text-center mb-2">Belopp</p>
            <div className="flex items-baseline justify-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={amountDisplay}
                onChange={handleAmountChange}
                autoFocus
                className="text-4xl font-bold bg-transparent placeholder:text-muted-foreground/30 caret-hb-cognac tabular-nums text-right"
                style={{
                  outline: 'none',
                  boxShadow: 'none',
                  border: 'none',
                  width: `${Math.max((amountDisplay || '0').length, 1) * 1.5}rem`,
                  minWidth: '1.5rem',
                  maxWidth: '12rem',
                  padding: 0,
                }}
              />
              <span className="text-xl text-muted-foreground font-medium shrink-0">
                {currencyInfo?.symbol || 'kr'}
              </span>
            </div>
            {isNonSEK && amountDisplay && parseInt(amountDisplay) > 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                ≈ {formatCurrency(convertToSEK(parseInt(amountDisplay), budget.exchange_rate))}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Beskrivning</Label>
            <input
              placeholder="Vad köpte du?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(inputStyles, 'placeholder:text-muted-foreground/50')}
              style={{ outline: 'none', boxShadow: 'none' }}
            />
          </div>

          {/* Project Category */}
          {budget.temporary_budget_categories.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Projektkategori</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProjectCatOpen(!projectCatOpen)}
                  className={cn(inputStyles, 'flex items-center justify-between cursor-pointer text-left')}
                >
                  <span className={cn(!selectedProjectCategoryId && 'text-muted-foreground/50')}>
                    {selectedProjectCategoryId
                      ? budget.temporary_budget_categories.find(
                          (c) => c.id === selectedProjectCategoryId
                        )?.name
                      : 'Välj projektkategori (valfritt)'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform',
                      projectCatOpen && 'rotate-180'
                    )}
                  />
                </button>
                {projectCatOpen && (
                  <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjectCategoryId(null)
                        setProjectCatOpen(false)
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors text-sm text-muted-foreground"
                    >
                      <span>Ingen</span>
                      {!selectedProjectCategoryId && <Check className="w-4 h-4 text-hb-cognac" />}
                    </button>
                    {budget.temporary_budget_categories
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedProjectCategoryId(cat.id)
                            setProjectCatOpen(false)
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                        >
                          <span>{cat.name}</span>
                          {selectedProjectCategoryId === cat.id && (
                            <Check className="w-4 h-4 text-hb-cognac" />
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Regular Category (required) — hidden when linked to a monthly budget category */}
          {!budget.linked_category_id && <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Budgetkategori</Label>
            <div className="relative">
              <div
                className={cn(inputStyles, 'flex items-center justify-between cursor-pointer')}
                onClick={() => {
                  setRegularCatOpen(true)
                  setTimeout(() => regularCatInputRef.current?.focus(), 0)
                }}
              >
                {regularCatOpen ? (
                  <input
                    ref={regularCatInputRef}
                    type="text"
                    placeholder="Sök kategori..."
                    value={regularCatSearch}
                    onChange={(e) => setRegularCatSearch(e.target.value)}
                    className="flex-1 bg-transparent text-base placeholder:text-muted-foreground/50"
                    style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={cn(!selectedRegularCategory && 'text-muted-foreground/50')}>
                    {selectedRegularCategory?.name || 'Välj kategori'}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    regularCatOpen && 'rotate-180'
                  )}
                />
              </div>
              {regularCatOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto">
                  {!hasFilteredResults ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Ingen kategori hittades
                    </div>
                  ) : (
                    <>
                      {filteredRegularCategories.variable.length > 0 && (
                        <div>
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                            Rörliga kostnader
                          </div>
                          {filteredRegularCategories.variable.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedRegularCategoryId(cat.id)
                                setRegularCatOpen(false)
                                setRegularCatSearch('')
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                            >
                              <span>{cat.name}</span>
                              {selectedRegularCategoryId === cat.id && (
                                <Check className="w-4 h-4 text-hb-cognac" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {filteredRegularCategories.fixed.length > 0 && (
                        <div>
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                            Fasta kostnader
                          </div>
                          {filteredRegularCategories.fixed.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedRegularCategoryId(cat.id)
                                setRegularCatOpen(false)
                                setRegularCatSearch('')
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                            >
                              <span>{cat.name}</span>
                              {selectedRegularCategoryId === cat.id && (
                                <Check className="w-4 h-4 text-hb-cognac" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {filteredRegularCategories.savings.length > 0 && (
                        <div>
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                            Sparande
                          </div>
                          {filteredRegularCategories.savings.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedRegularCategoryId(cat.id)
                                setRegularCatOpen(false)
                                setRegularCatSearch('')
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                            >
                              <span>{cat.name}</span>
                              {selectedRegularCategoryId === cat.id && (
                                <Check className="w-4 h-4 text-hb-cognac" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>}

          {/* Date */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Datum</Label>
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.()}
              className={cn(inputStyles, 'text-left cursor-pointer')}
            >
              {formatDisplayDate(date)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="sr-only"
            />
          </div>

          {/* Cost Assignment */}
          {hasPartner && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-xs">Vems utgift?</Label>
                <span className="text-[10px] text-muted-foreground">
                  {costAssignment === 'shared' ? 'Delad 50/50' : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCostAssignment(costAssignment === 'personal' ? 'shared' : 'personal')
                  }
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                    costAssignment === 'personal'
                      ? 'bg-hb-cognac text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {user?.first_name || 'Mig'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCostAssignment(costAssignment === 'partner' ? 'shared' : 'partner')
                  }
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                    costAssignment === 'partner'
                      ? 'bg-hb-cognac text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {partner?.first_name || 'Partner'}
                </button>
              </div>
            </div>
          )}

          {/* CCM Toggle */}
          {isCCMEnabled && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-hb-sand-deep/20">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-hb-terracotta" />
                <div>
                  <Label htmlFor="project-is_ccm" className="text-sm font-medium">
                    Betald med kreditkort
                  </Label>
                  <p className="text-xs text-muted-foreground">Registreras som CCM-utgift</p>
                </div>
              </div>
              <Switch
                id="project-is_ccm"
                checked={isCCM}
                onCheckedChange={setIsCCM}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              className="w-full bg-hb-cognac hover:bg-hb-cognac/90"
              disabled={createExpense.isPending}
            >
              {createExpense.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sparar...
                </>
              ) : (
                'Lägg till utgift'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
