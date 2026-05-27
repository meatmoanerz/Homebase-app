'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { useCreateExpense } from '@/hooks/use-expenses'
import { useCategoriesByType } from '@/hooks/use-categories'
import { useUser, usePartner } from '@/hooks/use-user'
import { toast } from 'sonner'
import { Loader2, CreditCard, ChevronDown, Check, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { cn } from '@/lib/utils/cn'
import type { Category } from '@/types'

const expenseSchema = z.object({
  amount: z.number().positive('Belopp måste vara positivt'),
  description: z.string().min(1, 'Beskrivning krävs'),
  category_id: z.string().uuid('Välj en kategori'),
  date: z.string(),
  is_ccm: z.boolean(),
  cost_assignment: z.enum(['personal', 'shared', 'partner']),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

interface ExpenseFormCompactProps {
  onSuccess?: () => void
}

export function ExpenseFormCompact({ onSuccess }: ExpenseFormCompactProps) {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { fixed, variable, savings } = useCategoriesByType()
  const createExpense = useCreateExpense()
  const hasPartner = !!partner
  const [amountDisplay, setAmountDisplay] = useState('')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const isCCMEnabled = user?.ccm_enabled || false

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      description: '',
      category_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      is_ccm: isCCMEnabled,
      cost_assignment: 'shared',
    },
  })

  const allCategories = useMemo(() => [...variable, ...fixed, ...savings], [variable, fixed, savings])
  const selectedCategory = allCategories.find(c => c.id === form.watch('category_id'))

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleCategorySelect = (category: Category) => {
    form.setValue('category_id', category.id)
    setCategoryOpen(false)
  }

  const formatDisplayDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return format(date, 'd MMM', { locale: sv })
    } catch {
      return dateStr
    }
  }

  async function onSubmit(data: ExpenseFormData) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    try {
      await createExpense.mutateAsync({
        ...data,
        user_id: user?.id || '',
      })
      toast.success('Utgift sparad!')
      setAmountDisplay('')
      form.reset({
        amount: 0,
        description: '',
        category_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        is_ccm: isCCMEnabled,
        cost_assignment: 'shared',
      })
      onSuccess?.()
    } catch {
      toast.error('Kunde inte spara utgift')
    }
  }

  // Category groups for chips - show first 3 from variable (most common)
  const quickCategories = useMemo(() => {
    return variable.slice(0, 6)
  }, [variable])

  const categoryGroups = [
    { label: 'Rörligt', items: variable },
    { label: 'Fast', items: fixed },
    { label: 'Spar', items: savings },
  ]

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Row 1: Amount - larger and more prominent */}
      <div className="rounded-2xl bg-gradient-to-br from-hb-sage/30 to-hb-sand/20 p-4">
        <div className="flex items-center justify-center gap-2">
          <input
            ref={amountInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={amountDisplay}
            onChange={handleAmountChange}
            className="text-4xl font-bold bg-transparent placeholder:text-muted-foreground/30 caret-hb-cognac tabular-nums text-center w-full max-w-[200px]"
            style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
            autoFocus
          />
          <span className="text-lg text-muted-foreground font-medium">kr</span>
        </div>
        {form.formState.errors.amount && (
          <p className="text-destructive text-xs mt-2 text-center">{form.formState.errors.amount.message}</p>
        )}
      </div>

      {/* Row 2: Description */}
      <input
        placeholder="Vad handlade det om?"
        {...form.register('description')}
        className="w-full h-12 px-4 rounded-xl bg-muted text-base placeholder:text-muted-foreground/50"
        style={{ outline: 'none', boxShadow: 'none' }}
      />
      {form.formState.errors.description && (
        <p className="text-destructive text-xs -mt-3">{form.formState.errors.description.message}</p>
      )}

      {/* Row 3: Category chips */}
      <div ref={categoryDropdownRef} className="relative">
        <div className="flex gap-2 flex-wrap">
          {quickCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategorySelect(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                form.watch('category_id') === cat.id
                  ? "bg-hb-cognac text-white shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCategoryOpen(!categoryOpen)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 flex items-center gap-1.5",
              selectedCategory && !quickCategories.find(c => c.id === selectedCategory.id) && "bg-hb-cognac text-white"
            )}
          >
            {selectedCategory && !quickCategories.find(c => c.id === selectedCategory.id)
              ? selectedCategory.name
              : 'Fler'}
            <ChevronDown className={cn("w-4 h-4 transition-transform", categoryOpen && "rotate-180")} />
          </button>
        </div>

        {/* Dropdown for all categories */}
        {categoryOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-56 overflow-y-auto">
            {categoryGroups.map((group) => (
              group.items.length > 0 && (
                <div key={group.label}>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 uppercase sticky top-0">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-2">
                    {group.items.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategorySelect(cat)}
                        className={cn(
                          "px-3 py-2 text-left text-sm rounded-lg hover:bg-muted/50 flex items-center justify-between",
                          form.watch('category_id') === cat.id && "bg-hb-sage/30"
                        )}
                      >
                        <span>{cat.name}</span>
                        {form.watch('category_id') === cat.id && (
                          <Check className="w-4 h-4 text-hb-cognac" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
        {form.formState.errors.category_id && (
          <p className="text-destructive text-xs mt-2">{form.formState.errors.category_id.message}</p>
        )}
      </div>

      {/* Row 4: Date + Cost Assignment + CCM (horizontal, well spaced) */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date */}
        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker?.()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm font-medium"
        >
          <Calendar className="w-4 h-4 text-muted-foreground" />
          {formatDisplayDate(form.watch('date'))}
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={form.watch('date')}
          onChange={(e) => form.setValue('date', e.target.value)}
          className="sr-only"
        />

        {/* Cost Assignment */}
        {hasPartner && (
          <div className="flex rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => form.setValue('cost_assignment', 'personal')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                form.watch('cost_assignment') === 'personal'
                  ? "bg-white dark:bg-card shadow-sm text-hb-cognac"
                  : "text-muted-foreground"
              )}
            >
              {user?.first_name?.slice(0, 4) || 'Jag'}
            </button>
            <button
              type="button"
              onClick={() => form.setValue('cost_assignment', 'shared')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                form.watch('cost_assignment') === 'shared'
                  ? "bg-white dark:bg-card shadow-sm text-hb-cognac"
                  : "text-muted-foreground"
              )}
            >
              50/50
            </button>
            <button
              type="button"
              onClick={() => form.setValue('cost_assignment', 'partner')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                form.watch('cost_assignment') === 'partner'
                  ? "bg-white dark:bg-card shadow-sm text-hb-cognac"
                  : "text-muted-foreground"
              )}
            >
              {partner?.first_name?.slice(0, 4) || 'P'}
            </button>
          </div>
        )}

        {/* CCM Toggle */}
        {isCCMEnabled && (
          <button
            type="button"
            onClick={() => form.setValue('is_ccm', !form.watch('is_ccm'))}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              form.watch('is_ccm')
                ? "bg-hb-terracotta/20 text-hb-terracotta"
                : "bg-muted text-muted-foreground"
            )}
          >
            <CreditCard className="w-4 h-4" />
            Kreditkort
          </button>
        )}
      </div>

      {/* Submit Button - full width, prominent */}
      <Button
        type="submit"
        className="w-full h-12 text-base font-semibold"
        disabled={createExpense.isPending}
      >
        {createExpense.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          'Spara utgift'
        )}
      </Button>
    </form>
  )
}
