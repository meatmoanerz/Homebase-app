'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useUser, usePartner } from '@/hooks/use-user'
import { useCategories } from '@/hooks/use-categories'
import {
  useCreateTemporaryBudget,
  useUpdateTemporaryBudget,
  useDeleteTemporaryBudgetCategory,
  useCreateTemporaryBudgetCategory,
} from '@/hooks/use-temporary-budgets'
import { CURRENCIES, getCurrency, convertToSEK } from '@/lib/utils/currencies'
import { formatCurrency } from '@/lib/utils/formatters'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  Check,
  AlertTriangle,
  Plane,
  Home,
  Utensils,
  Car,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TemporaryBudgetWithDetails } from '@/types'
import { format } from 'date-fns'

const QUICK_CATEGORIES = [
  { name: 'Flyg', icon: Plane },
  { name: 'Hotell', icon: Home },
  { name: 'Mat', icon: Utensils },
  { name: 'Transport', icon: Car },
  { name: 'Shopping', icon: ShoppingBag },
  { name: 'Aktiviteter', icon: Sparkles },
]

const formSchema = z.object({
  name: z.string().min(1, 'Namn krävs'),
  description: z.string().optional(),
  total_budget: z.number().positive('Budget måste vara ett positivt belopp'),
  currency: z.string().min(1),
  exchange_rate: z.number().positive(),
  start_date: z.string().min(1, 'Startdatum krävs'),
  end_date: z.string().min(1, 'Slutdatum krävs'),
  is_shared: z.boolean(),
  linked_budget_period: z.string().nullable(),
  linked_category_id: z.string().nullable(),
})

type FormData = z.infer<typeof formSchema>

interface CategoryItem {
  id?: string
  name: string
  budgeted_amount: number
  sort_order: number
  isNew?: boolean
}

interface TemporaryBudgetFormProps {
  existingBudget?: TemporaryBudgetWithDetails
}

export function TemporaryBudgetForm({ existingBudget }: TemporaryBudgetFormProps) {
  const router = useRouter()
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: monthlyCategories } = useCategories()
  const createBudget = useCreateTemporaryBudget()
  const updateBudget = useUpdateTemporaryBudget()
  const createCategory = useCreateTemporaryBudgetCategory()
  const deleteCategory = useDeleteTemporaryBudgetCategory()
  const hasPartner = !!partner
  const isEditing = !!existingBudget

  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    if (existingBudget?.temporary_budget_categories) {
      return existingBudget.temporary_budget_categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        budgeted_amount: cat.budgeted_amount,
        sort_order: cat.sort_order,
      }))
    }
    return []
  })
  const [newCategoryName, setNewCategoryName] = useState('')
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [showNoLinkWarning, setShowNoLinkWarning] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: existingBudget?.name || '',
      description: existingBudget?.description || '',
      total_budget: existingBudget?.total_budget || 0,
      currency: existingBudget?.currency || 'SEK',
      exchange_rate: existingBudget?.exchange_rate || 1,
      start_date: existingBudget?.start_date || format(new Date(), 'yyyy-MM-dd'),
      end_date: existingBudget?.end_date || '',
      is_shared: existingBudget?.is_shared || false,
      linked_budget_period: existingBudget?.linked_budget_period || null,
      linked_category_id: existingBudget?.linked_category_id || null,
    },
  })

  const watchCurrency = form.watch('currency')
  const watchExchangeRate = form.watch('exchange_rate')
  const watchTotalBudget = form.watch('total_budget')
  const watchLinkedPeriod = form.watch('linked_budget_period')
  const watchLinkedCategoryId = form.watch('linked_category_id')
  const isNonSEK = watchCurrency !== 'SEK'

  const totalCategorized = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.budgeted_amount, 0)
  }, [categories])

  const totalBudgetSEK = useMemo(() => {
    if (isNonSEK) {
      return convertToSEK(watchTotalBudget, watchExchangeRate)
    }
    return watchTotalBudget
  }, [watchTotalBudget, watchExchangeRate, isNonSEK])

  const categoryDifference = watchTotalBudget - totalCategorized

  const handleCurrencyChange = (code: string) => {
    form.setValue('currency', code)
    const currency = getCurrency(code)
    if (currency) {
      form.setValue('exchange_rate', currency.defaultRate)
    }
    setCurrencyOpen(false)
  }

  const handleAddCategory = (name?: string) => {
    const catName = name || newCategoryName.trim()
    if (!catName) return
    if (categories.some((c) => c.name.toLowerCase() === catName.toLowerCase())) {
      toast.error('Kategori finns redan')
      return
    }
    setCategories((prev) => [
      ...prev,
      { name: catName, budgeted_amount: 0, sort_order: prev.length, isNew: true },
    ])
    setNewCategoryName('')
  }

  const handleRemoveCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCategoryAmountChange = (index: number, amount: number) => {
    setCategories((prev) =>
      prev.map((cat, i) => (i === index ? { ...cat, budgeted_amount: amount } : cat))
    )
  }

  const [budgetDisplay, setBudgetDisplay] = useState(
    existingBudget?.total_budget ? existingBudget.total_budget.toString() : ''
  )

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '') {
      setBudgetDisplay('')
      form.setValue('total_budget', 0)
      return
    }
    const numValue = parseInt(value.replace(/\D/g, ''), 10)
    if (!isNaN(numValue)) {
      setBudgetDisplay(numValue.toString())
      form.setValue('total_budget', numValue)
    }
  }

  async function onSubmit(data: FormData) {
    // Warn if no monthly budget link
    if (!data.linked_budget_period && !showNoLinkWarning && !isEditing) {
      setShowNoLinkWarning(true)
      return
    }

    try {
      if (isEditing && existingBudget) {
        // Update budget
        await updateBudget.mutateAsync({
          id: existingBudget.id,
          name: data.name,
          description: data.description || null,
          total_budget: isNonSEK ? totalBudgetSEK : data.total_budget,
          currency: data.currency,
          exchange_rate: data.exchange_rate,
          start_date: data.start_date,
          end_date: data.end_date,
          is_shared: data.is_shared,
          linked_budget_period: data.linked_budget_period,
          linked_category_id: data.linked_budget_period ? data.linked_category_id : null,
        })

        // Handle category changes
        const existingCats = existingBudget.temporary_budget_categories || []
        const existingCatIds = new Set(existingCats.map((c) => c.id))
        const currentCatIds = new Set(categories.filter((c) => c.id).map((c) => c.id!))

        // Delete removed categories
        for (const cat of existingCats) {
          if (!currentCatIds.has(cat.id)) {
            await deleteCategory.mutateAsync({ id: cat.id, budgetId: existingBudget.id })
          }
        }

        // Add new categories
        for (const cat of categories) {
          if (!cat.id || !existingCatIds.has(cat.id)) {
            await createCategory.mutateAsync({
              temporary_budget_id: existingBudget.id,
              name: cat.name,
              budgeted_amount: isNonSEK
                ? convertToSEK(cat.budgeted_amount, watchExchangeRate)
                : cat.budgeted_amount,
              sort_order: cat.sort_order,
            })
          }
        }

        toast.success('Projektbudget uppdaterad')
        router.push(`/budget/project/${existingBudget.id}`)
      } else {
        // Create new budget
        const result = await createBudget.mutateAsync({
          budget: {
            name: data.name,
            description: data.description || null,
            total_budget: isNonSEK ? totalBudgetSEK : data.total_budget,
            currency: data.currency,
            exchange_rate: data.exchange_rate,
            start_date: data.start_date,
            end_date: data.end_date,
            is_shared: data.is_shared,
            linked_budget_period: data.linked_budget_period,
            linked_category_id: data.linked_budget_period ? data.linked_category_id : null,
          },
          categories: categories.map((cat, i) => ({
            name: cat.name,
            budgeted_amount: isNonSEK
              ? convertToSEK(cat.budgeted_amount, watchExchangeRate)
              : cat.budgeted_amount,
            sort_order: i,
          })),
        })
        toast.success('Projektbudget skapad')
        router.push(`/budget/project/${result.id}`)
      }
    } catch {
      toast.error(isEditing ? 'Kunde inte uppdatera projektbudget' : 'Kunde inte skapa projektbudget')
    }
  }

  const inputStyles =
    'w-full h-11 px-4 rounded-xl bg-muted text-sm transition-colors focus:outline-none focus:ring-0 focus:border-0'

  const currencyInfo = getCurrency(watchCurrency)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-hb-cognac">
          {isEditing ? 'Redigera projektbudget' : 'Ny projektbudget'}
        </h1>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Name & Description */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Projektnamn</Label>
              <input
                placeholder="t.ex. Thailand-resa, Kök renovering"
                {...form.register('name')}
                className={cn(inputStyles, 'placeholder:text-muted-foreground/50')}
                style={{ outline: 'none', boxShadow: 'none' }}
              />
              {form.formState.errors.name && (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Beskrivning (valfritt)</Label>
              <input
                placeholder="Kort beskrivning av projektet"
                {...form.register('description')}
                className={cn(inputStyles, 'placeholder:text-muted-foreground/50')}
                style={{ outline: 'none', boxShadow: 'none' }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Startdatum</Label>
                <input
                  type="date"
                  {...form.register('start_date')}
                  className={inputStyles}
                  style={{ outline: 'none', boxShadow: 'none' }}
                />
                {form.formState.errors.start_date && (
                  <p className="text-destructive text-xs">
                    {form.formState.errors.start_date.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Slutdatum</Label>
                <input
                  type="date"
                  {...form.register('end_date')}
                  className={inputStyles}
                  style={{ outline: 'none', boxShadow: 'none' }}
                />
                {form.formState.errors.end_date && (
                  <p className="text-destructive text-xs">
                    {form.formState.errors.end_date.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Amount & Currency */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            {/* Total Budget */}
            <div className="rounded-xl bg-hb-sand/20 py-5 px-6">
              <p className="text-muted-foreground text-xs text-center mb-2">Total budget</p>
              <div className="flex items-baseline justify-center gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={budgetDisplay}
                  onChange={handleBudgetChange}
                  className="text-4xl font-bold bg-transparent placeholder:text-muted-foreground/30 caret-hb-cognac tabular-nums text-right"
                  style={{
                    outline: 'none',
                    boxShadow: 'none',
                    border: 'none',
                    width: `${Math.max((budgetDisplay || '0').length, 1) * 1.5}rem`,
                    minWidth: '1.5rem',
                    maxWidth: '12rem',
                    padding: 0,
                  }}
                />
                <span className="text-xl text-muted-foreground font-medium shrink-0">
                  {currencyInfo?.symbol || 'kr'}
                </span>
              </div>
              {isNonSEK && watchTotalBudget > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  ≈ {formatCurrency(totalBudgetSEK)}
                </p>
              )}
              {form.formState.errors.total_budget && (
                <p className="text-destructive text-xs mt-2 text-center">
                  {form.formState.errors.total_budget.message}
                </p>
              )}
            </div>

            {/* Currency Selector */}
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
                      className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto"
                    >
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleCurrencyChange(c.code)}
                          className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors text-sm"
                        >
                          <span>
                            {c.symbol} {c.code} — {c.name}
                          </span>
                          {watchCurrency === c.code && (
                            <Check className="w-4 h-4 text-hb-cognac" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Exchange Rate (only for non-SEK) */}
            {isNonSEK && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">
                  Växelkurs (1 {watchCurrency} = X SEK)
                </Label>
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  value={watchExchangeRate}
                  onChange={(e) => form.setValue('exchange_rate', parseFloat(e.target.value) || 1)}
                  className={inputStyles}
                  style={{ outline: 'none', boxShadow: 'none' }}
                />
                <p className="text-xs text-muted-foreground">
                  Kan justeras senare i inställningar
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-sm font-medium">Kategorier</Label>
              {categories.length > 0 && categoryDifference !== 0 && (
                <span
                  className={cn(
                    'text-xs font-medium',
                    categoryDifference > 0 ? 'text-muted-foreground' : 'text-destructive'
                  )}
                >
                  {categoryDifference > 0
                    ? `${categoryDifference.toLocaleString('sv-SE')} ${currencyInfo?.symbol || 'kr'} ofördelat`
                    : `${Math.abs(categoryDifference).toLocaleString('sv-SE')} ${currencyInfo?.symbol || 'kr'} över`}
                </span>
              )}
            </div>

            {/* Quick-add buttons */}
            {categories.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {QUICK_CATEGORIES.map((qc) => {
                  const Icon = qc.icon
                  return (
                    <button
                      key={qc.name}
                      type="button"
                      onClick={() => handleAddCategory(qc.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-hb-sand/20 text-hb-cognac text-xs font-medium hover:bg-hb-sand/30 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {qc.name}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Category list */}
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {categories.map((cat, index) => (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm flex-1 min-w-0 truncate">{cat.name}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0"
                        value={cat.budgeted_amount || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value.replace(/\D/g, ''), 10)
                          handleCategoryAmountChange(index, isNaN(val) ? 0 : val)
                        }}
                        className="w-24 h-9 px-3 rounded-lg bg-muted text-sm text-right tabular-nums"
                        style={{ outline: 'none', boxShadow: 'none' }}
                      />
                      <span className="text-xs text-muted-foreground w-6">
                        {currencyInfo?.symbol || 'kr'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(index)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Add custom category */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ny kategori..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCategory()
                  }
                }}
                className={cn(inputStyles, 'flex-1 placeholder:text-muted-foreground/50')}
                style={{ outline: 'none', boxShadow: 'none' }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleAddCategory()}
                disabled={!newCategoryName.trim()}
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick-add when categories exist */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CATEGORIES.filter(
                  (qc) => !categories.some((c) => c.name.toLowerCase() === qc.name.toLowerCase())
                ).map((qc) => {
                  const Icon = qc.icon
                  return (
                    <button
                      key={qc.name}
                      type="button"
                      onClick={() => handleAddCategory(qc.name)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-medium hover:bg-muted/80 transition-colors"
                    >
                      <Icon className="w-3 h-3" />
                      {qc.name}
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Partner Sharing */}
        {hasPartner && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Dela med partner</Label>
                  <p className="text-xs text-muted-foreground">
                    {partner?.first_name || 'Partner'} kan se och lägga till utgifter
                  </p>
                </div>
                <Switch
                  checked={form.watch('is_shared')}
                  onCheckedChange={(checked) => form.setValue('is_shared', checked)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Budget Link */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Koppla till månadsbudget</Label>
                <p className="text-xs text-muted-foreground">
                  Allokera belopp från din månadsbudget
                </p>
              </div>
              <Switch
                checked={!!watchLinkedPeriod}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    form.setValue('linked_budget_period', null)
                    form.setValue('linked_category_id', null)
                  } else {
                    // Default to current month
                    const now = new Date()
                    const salaryDay = user?.salary_day || 25
                    const day = now.getDate()
                    let month = now.getMonth() + 1
                    let year = now.getFullYear()
                    if (day >= salaryDay) {
                      month += 1
                      if (month > 12) {
                        month = 1
                        year += 1
                      }
                    }
                    form.setValue(
                      'linked_budget_period',
                      `${year}-${String(month).padStart(2, '0')}`
                    )
                  }
                }}
              />
            </div>

            {/* Category dropdown when linked */}
            {!!watchLinkedPeriod && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Budgetkategori</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    className={cn(inputStyles, 'flex items-center justify-between cursor-pointer text-left')}
                  >
                    <span className={!watchLinkedCategoryId ? 'text-muted-foreground/50' : ''}>
                      {watchLinkedCategoryId
                        ? monthlyCategories?.find((c) => c.id === watchLinkedCategoryId)?.name || 'Välj kategori'
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
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto"
                      >
                        {monthlyCategories?.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              form.setValue('linked_category_id', cat.id)
                              setCategoryDropdownOpen(false)
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors text-sm"
                          >
                            <span>{cat.name}</span>
                            {watchLinkedCategoryId === cat.id && (
                              <Check className="w-4 h-4 text-hb-cognac" />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-xs text-muted-foreground">
                  Projektkostnader allokeras till denna kategori i månadsbudgeten
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* No-link warning */}
        <AnimatePresence>
          {showNoLinkWarning && !watchLinkedPeriod && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Ingen koppling till månadsbudget</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Utgifter i denna projektbudget kommer inte att räknas i din månadsbudget.
                        Du kan ändra detta senare i projektbudgetens inställningar.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          type="submit"
                          size="sm"
                          className="bg-hb-cognac hover:bg-hb-cognac/90"
                        >
                          Skapa ändå
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNoLinkWarning(false)}
                        >
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        {!showNoLinkWarning && (
          <Button
            type="submit"
            className="w-full h-12 bg-hb-cognac hover:bg-hb-cognac/90 text-white font-medium rounded-xl"
            disabled={createBudget.isPending || updateBudget.isPending}
          >
            {createBudget.isPending || updateBudget.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? 'Sparar...' : 'Skapar...'}
              </>
            ) : isEditing ? (
              'Spara ändringar'
            ) : (
              'Skapa projektbudget'
            )}
          </Button>
        )}
      </form>
    </motion.div>
  )
}
