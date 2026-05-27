'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateRecurringExpense } from '@/hooks/use-recurring-expenses'
import { useCategoriesByType } from '@/hooks/use-categories'
import { useUser, usePartner } from '@/hooks/use-user'
import { toast } from 'sonner'
import { Loader2, CreditCard, ChevronDown, Check, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Category } from '@/types'

const recurringExpenseSchema = z.object({
  amount: z.number().positive('Belopp måste vara positivt'),
  description: z.string().min(1, 'Beskrivning krävs'),
  category_id: z.string().uuid('Välj en kategori'),
  day_of_month: z.number().min(1).max(31),
  is_ccm: z.boolean(),
  cost_assignment: z.enum(['personal', 'shared', 'partner']),
  is_active: z.boolean(),
})

type RecurringExpenseFormData = z.infer<typeof recurringExpenseSchema>

interface RecurringExpenseFormProps {
  onSuccess?: () => void
}

export function RecurringExpenseForm({ onSuccess }: RecurringExpenseFormProps) {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { fixed, variable, savings } = useCategoriesByType()
  const createRecurringExpense = useCreateRecurringExpense()
  const hasPartner = !!partner
  const [amountDisplay, setAmountDisplay] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const categoryInputRef = useRef<HTMLInputElement>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const dayPickerRef = useRef<HTMLDivElement>(null)

  const form = useForm<RecurringExpenseFormData>({
    resolver: zodResolver(recurringExpenseSchema),
    defaultValues: {
      amount: 0,
      description: '',
      category_id: '',
      day_of_month: 1,
      is_ccm: false,
      cost_assignment: 'shared',
      is_active: true,
    },
  })

  const allCategories = useMemo(() => [...variable, ...fixed, ...savings], [variable, fixed, savings])

  const selectedCategory = allCategories.find(c => c.id === form.watch('category_id'))

  const filteredCategories = useMemo(() => {
    if (!categorySearch) return { variable, fixed, savings }
    const search = categorySearch.toLowerCase()
    return {
      variable: variable.filter(c => c.name.toLowerCase().includes(search)),
      fixed: fixed.filter(c => c.name.toLowerCase().includes(search)),
      savings: savings.filter(c => c.name.toLowerCase().includes(search)),
    }
  }, [categorySearch, variable, fixed, savings])

  // Auto-focus amount input on mount
  useEffect(() => {
    if (amountInputRef.current) {
      amountInputRef.current.focus()
    }
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryOpen(false)
      }
      if (dayPickerRef.current && !dayPickerRef.current.contains(event.target as Node)) {
        setDayPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isCCMEnabled = user?.ccm_enabled || false

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (value === '') {
      setAmountDisplay('')
      form.setValue('amount', 0)
      return
    }

    const numValue = parseInt(value.replace(/\D/g, ''), 10)
    if (!isNaN(numValue)) {
      setAmountDisplay(numValue.toString())
      form.setValue('amount', numValue)
    }
  }

  const handleAmountFocus = () => {
    if (amountInputRef.current && amountDisplay) {
      amountInputRef.current.select()
    }
  }

  const handleCategorySelect = (category: Category) => {
    form.setValue('category_id', category.id)
    setCategorySearch('')
    setCategoryOpen(false)
  }

  const handleDaySelect = (day: number) => {
    form.setValue('day_of_month', day)
    setDayPickerOpen(false)
  }

  const getDayDisplay = (day: number) => {
    if (day === 31) return 'Sista dagen i månaden'
    return `Den ${day}:e varje månad`
  }

  async function onSubmit(data: RecurringExpenseFormData) {
    try {
      await createRecurringExpense.mutateAsync(data as any)
      toast.success('Återkommande utgift sparad! 🔄')
      setAmountDisplay('')
      setCategorySearch('')
      form.reset({
        amount: 0,
        description: '',
        category_id: '',
        day_of_month: 1,
        is_ccm: false,
        cost_assignment: 'shared',
        is_active: true,
      })
      if (amountInputRef.current) {
        amountInputRef.current.focus()
      }
      onSuccess?.()
    } catch {
      toast.error('Kunde inte spara återkommande utgift')
    }
  }

  const hasFilteredResults = filteredCategories.variable.length > 0 ||
    filteredCategories.fixed.length > 0 ||
    filteredCategories.savings.length > 0

  // Common input styles without focus ring - compact height
  const inputStyles = "w-full h-11 px-4 rounded-xl bg-muted text-sm transition-colors focus:outline-none focus:ring-0 focus:border-0"

  // Generate days 1-28 + 31 (last day)
  const dayOptions = [...Array(28)].map((_, i) => i + 1).concat([31])

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Amount - Compact centered input */}
      <div className="rounded-xl bg-hb-sage/20 py-5 px-6">
        <p className="text-muted-foreground text-xs text-center mb-2">Belopp</p>
        <div className="flex items-baseline justify-center gap-1">
          <input
            ref={amountInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={amountDisplay}
            onChange={handleAmountChange}
            onFocus={handleAmountFocus}
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
            autoFocus
          />
          <span className="text-xl text-muted-foreground font-medium shrink-0">kr</span>
        </div>
        {form.formState.errors.amount && (
          <p className="text-destructive text-xs mt-2 text-center">
            {form.formState.errors.amount.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-muted-foreground text-sm">Beskrivning</Label>
        <input
          id="description"
          placeholder="T.ex. Netflix, Spotify, etc."
          {...form.register('description')}
          className={cn(inputStyles, "placeholder:text-muted-foreground/50")}
          style={{ outline: 'none', boxShadow: 'none' }}
        />
        {form.formState.errors.description && (
          <p className="text-destructive text-xs">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>

      {/* Category - Searchable dropdown */}
      <div className="space-y-2" ref={categoryDropdownRef}>
        <Label className="text-muted-foreground text-sm">Kategori</Label>
        <div className="relative">
          <div
            className={cn(inputStyles, "flex items-center justify-between cursor-pointer")}
            onClick={() => {
              setCategoryOpen(true)
              setTimeout(() => categoryInputRef.current?.focus(), 0)
            }}
          >
            {categoryOpen ? (
              <input
                ref={categoryInputRef}
                type="text"
                placeholder="Sök kategori..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="flex-1 bg-transparent text-base placeholder:text-muted-foreground/50"
                style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={cn(!selectedCategory && "text-muted-foreground/50")}>
                {selectedCategory?.name || 'Välj kategori'}
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", categoryOpen && "rotate-180")} />
          </div>

          {categoryOpen && (
            <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto">
              {!hasFilteredResults ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Ingen kategori hittades
                </div>
              ) : (
                <>
                  {filteredCategories.variable.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                        Rörliga kostnader
                      </div>
                      {filteredCategories.variable.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategorySelect(cat)}
                          className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                        >
                          <span>{cat.name}</span>
                          {form.watch('category_id') === cat.id && (
                            <Check className="w-4 h-4 text-hb-cognac" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredCategories.fixed.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                        Fasta kostnader
                      </div>
                      {filteredCategories.fixed.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategorySelect(cat)}
                          className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                        >
                          <span>{cat.name}</span>
                          {form.watch('category_id') === cat.id && (
                            <Check className="w-4 h-4 text-hb-cognac" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredCategories.savings.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                        Sparande
                      </div>
                      {filteredCategories.savings.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategorySelect(cat)}
                          className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                        >
                          <span>{cat.name}</span>
                          {form.watch('category_id') === cat.id && (
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
        {form.formState.errors.category_id && (
          <p className="text-destructive text-xs">
            {form.formState.errors.category_id.message}
          </p>
        )}
      </div>

      {/* Day of Month Picker */}
      <div className="space-y-2" ref={dayPickerRef}>
        <Label className="text-muted-foreground text-sm">Återkommer varje månad</Label>
        <div className="relative">
          <div
            className={cn(inputStyles, "flex items-center justify-between cursor-pointer")}
            onClick={() => setDayPickerOpen(!dayPickerOpen)}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{getDayDisplay(form.watch('day_of_month'))}</span>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", dayPickerOpen && "rotate-180")} />
          </div>

          {dayPickerOpen && (
            <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto">
              <div className="grid grid-cols-4 gap-1 p-2">
                {dayOptions.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDaySelect(day)}
                    className={cn(
                      "py-2 px-3 text-sm rounded-lg transition-colors",
                      form.watch('day_of_month') === day
                        ? "bg-hb-cognac text-white font-medium"
                        : "hover:bg-muted/50"
                    )}
                  >
                    {day === 31 ? 'Sista' : day}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {form.formState.errors.day_of_month && (
          <p className="text-destructive text-xs">
            {form.formState.errors.day_of_month.message}
          </p>
        )}
      </div>

      {/* Cost Assignment - Only show if partner is connected */}
      {hasPartner && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs">Vems utgift?</Label>
            <span className="text-[10px] text-muted-foreground">
              {form.watch('cost_assignment') === 'shared' ? 'Delad 50/50' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => form.setValue('cost_assignment', form.watch('cost_assignment') === 'personal' ? 'shared' : 'personal')}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                form.watch('cost_assignment') === 'personal'
                  ? "bg-hb-cognac text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {user?.first_name || 'Mig'}
            </button>
            <button
              type="button"
              onClick={() => form.setValue('cost_assignment', form.watch('cost_assignment') === 'partner' ? 'shared' : 'partner')}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                form.watch('cost_assignment') === 'partner'
                  ? "bg-hb-cognac text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
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
              <Label htmlFor="is_ccm" className="text-sm font-medium">
                Betald med kreditkort
              </Label>
              <p className="text-xs text-muted-foreground">
                Registreras som CCM-utgift
              </p>
            </div>
          </div>
          <Switch
            id="is_ccm"
            checked={form.watch('is_ccm')}
            onCheckedChange={(checked) => form.setValue('is_ccm', checked)}
          />
        </div>
      )}

      {/* Active Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
        <div>
          <Label htmlFor="is_active" className="text-sm font-medium">
            Aktiv
          </Label>
          <p className="text-xs text-muted-foreground">
            Inaktiva utgifter registreras inte automatiskt
          </p>
        </div>
        <Switch
          id="is_active"
          checked={form.watch('is_active')}
          onCheckedChange={(checked) => form.setValue('is_active', checked)}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full h-11"
        disabled={createRecurringExpense.isPending}
      >
        {createRecurringExpense.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sparar...
          </>
        ) : (
          'Spara återkommande utgift'
        )}
      </Button>
    </form>
  )
}
