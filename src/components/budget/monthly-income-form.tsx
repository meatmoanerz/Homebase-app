'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  useCreateMonthlyIncome,
  useUpdateMonthlyIncome,
  INCOME_TYPES,
} from '@/hooks/use-monthly-incomes'
import { toast } from 'sonner'
import { Loader2, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { HouseholdMonthlyIncome } from '@/types'

const incomeSchema = z.object({
  name: z.string().min(1, 'Typ av inkomst krävs'),
  amount: z.number().positive('Belopp måste vara positivt'),
})

type IncomeFormData = z.infer<typeof incomeSchema>

interface MonthlyIncomeFormProps {
  period: string
  editingIncome?: HouseholdMonthlyIncome | null
  onEditComplete?: () => void
  hasPartner?: boolean
  userName?: string
  partnerName?: string
}

export function MonthlyIncomeForm({
  period,
  editingIncome,
  onEditComplete,
  hasPartner = false,
  userName = 'Du',
  partnerName = 'Partner',
}: MonthlyIncomeFormProps) {
  const createIncome = useCreateMonthlyIncome()
  const updateIncome = useUpdateMonthlyIncome()
  const [amountDisplay, setAmountDisplay] = useState('')
  const [typeSearch, setTypeSearch] = useState('')
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [forPartner, setForPartner] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const typeInputRef = useRef<HTMLInputElement>(null)
  const typeDropdownRef = useRef<HTMLDivElement>(null)

  const isEditing = !!editingIncome

  const form = useForm<IncomeFormData>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      name: '',
      amount: 0,
    },
  })

  // Populate form when editing
  useEffect(() => {
    if (editingIncome) {
      form.setValue('name', editingIncome.name)
      form.setValue('amount', editingIncome.amount)
      setAmountDisplay(editingIncome.amount.toString())
      setTypeSearch('')
      setForPartner(!editingIncome.is_own)
    }
  }, [editingIncome, form])

  // Filter income types based on search
  const filteredTypes = useMemo(() => {
    if (!typeSearch) return [...INCOME_TYPES]
    const search = typeSearch.toLowerCase()
    const filtered = INCOME_TYPES.filter(type =>
      type.toLowerCase().includes(search)
    )
    // Add custom option if not in list
    if (typeSearch && !INCOME_TYPES.some(t => t.toLowerCase() === typeSearch.toLowerCase())) {
      return [...filtered, typeSearch]
    }
    return filtered
  }, [typeSearch])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setTypeDropdownOpen(false)
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

  const handleAmountFocus = () => {
    if (amountInputRef.current && amountDisplay) {
      amountInputRef.current.select()
    }
  }

  const handleTypeSelect = (type: string) => {
    form.setValue('name', type)
    setTypeSearch('')
    setTypeDropdownOpen(false)
  }

  async function onSubmit(data: IncomeFormData) {
    try {
      if (isEditing && editingIncome) {
        await updateIncome.mutateAsync({
          id: editingIncome.id,
          period,
          name: data.name,
          amount: data.amount,
        })
        toast.success('Inkomst uppdaterad')
        onEditComplete?.()
      } else {
        await createIncome.mutateAsync({
          period,
          name: data.name,
          amount: data.amount,
          for_partner: forPartner,
        })
        toast.success('Inkomst sparad')
      }

      // Reset form
      setAmountDisplay('')
      setTypeSearch('')
      setForPartner(false)
      form.reset({
        name: '',
        amount: 0,
      })
    } catch {
      toast.error(isEditing ? 'Kunde inte uppdatera inkomst' : 'Kunde inte spara inkomst')
    }
  }

  const handleCancel = () => {
    setAmountDisplay('')
    setTypeSearch('')
    setForPartner(false)
    form.reset({
      name: '',
      amount: 0,
    })
    onEditComplete?.()
  }

  const isPending = createIncome.isPending || updateIncome.isPending
  const selectedType = form.watch('name')

  // Common input styles
  const inputStyles = "w-full h-11 px-4 rounded-xl bg-muted text-sm transition-colors focus:outline-none focus:ring-0 focus:border-0"

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Amount */}
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
          />
          <span className="text-xl text-muted-foreground font-medium shrink-0">kr</span>
        </div>
        {form.formState.errors.amount && (
          <p className="text-destructive text-xs mt-2 text-center">
            {form.formState.errors.amount.message}
          </p>
        )}
      </div>

      {/* Income Type - Searchable dropdown */}
      <div className="space-y-2" ref={typeDropdownRef}>
        <Label className="text-muted-foreground text-sm">Typ av inkomst</Label>
        <div className="relative">
          <div
            className={cn(inputStyles, "flex items-center justify-between cursor-pointer")}
            onClick={() => {
              setTypeDropdownOpen(true)
              setTimeout(() => typeInputRef.current?.focus(), 0)
            }}
          >
            {typeDropdownOpen ? (
              <input
                ref={typeInputRef}
                type="text"
                placeholder="Sök eller skriv egen..."
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
                className="flex-1 bg-transparent text-base placeholder:text-muted-foreground/50"
                style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={cn(!selectedType && "text-muted-foreground/50")}>
                {selectedType || 'Välj typ av inkomst'}
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", typeDropdownOpen && "rotate-180")} />
          </div>

          {typeDropdownOpen && (
            <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto">
              {filteredTypes.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Ingen typ hittades
                </div>
              ) : (
                filteredTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeSelect(type)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                  >
                    <span>{type}</span>
                    {selectedType === type && (
                      <Check className="w-4 h-4 text-hb-cognac" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {form.formState.errors.name && (
          <p className="text-destructive text-xs">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      {/* Person selector - only shown when partner is connected and not editing */}
      {hasPartner && !isEditing && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Gäller</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForPartner(false)}
              className={cn(
                "h-11 rounded-xl text-sm font-medium transition-colors",
                !forPartner
                  ? "bg-hb-cognac text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {userName}
            </button>
            <button
              type="button"
              onClick={() => setForPartner(true)}
              className={cn(
                "h-11 rounded-xl text-sm font-medium transition-colors",
                forPartner
                  ? "bg-hb-cognac text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {partnerName}
            </button>
          </div>
        </div>
      )}

      {/* Submit / Cancel */}
      <div className="flex gap-2">
        {isEditing && (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11"
            onClick={handleCancel}
          >
            Avbryt
          </Button>
        )}
        <Button
          type="submit"
          className={cn("h-11", isEditing ? "flex-1" : "w-full")}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sparar...
            </>
          ) : isEditing ? (
            'Uppdatera'
          ) : (
            'Lägg till inkomst'
          )}
        </Button>
      </div>
    </form>
  )
}
