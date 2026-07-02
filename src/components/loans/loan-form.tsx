'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateLoan, useUpdateLoan } from '@/hooks/use-loans'
import { useLoanGroups, useCreateLoanGroup, useEnsureDefaultLoanGroups, LOAN_GROUP_COLORS } from '@/hooks/use-loan-groups'
import { usePartner } from '@/hooks/use-user'
import { toast } from 'sonner'
import { Loader2, ChevronDown, Check, Landmark, Plus, Percent, Users, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { LoanGroup, LoanWithGroup } from '@/types'

const loanSchema = z.object({
  name: z.string().min(1, 'Namn krävs'),
  original_amount: z.number().positive('Lånebelopp måste vara positivt'),
  current_balance: z.number().min(0, 'Kan inte vara negativt'),
  interest_rate: z.number().min(0, 'Ränta kan inte vara negativ').max(100, 'Ränta kan inte vara över 100%'),
  monthly_amortization: z.number().min(0, 'Amortering kan inte vara negativ'),
  group_id: z.string().uuid().nullable().optional(),
  is_shared: z.boolean().optional(),
  include_in_budget: z.boolean().optional(),
})

type LoanFormData = z.infer<typeof loanSchema>

type AmortizationType = 'fixed' | 'percentage'

// Extended type that includes the budget flag (may not be in DB yet)
type LoanWithBudgetFlag = LoanWithGroup & { include_in_budget?: boolean }

interface LoanFormProps {
  loan?: LoanWithGroup | null
  onSuccess?: () => void
}

export function LoanForm({ loan, onSuccess }: LoanFormProps) {
  const { data: loanGroups, isLoading: groupsLoading } = useLoanGroups()
  const { data: partner } = usePartner()
  const createLoan = useCreateLoan()
  const updateLoan = useUpdateLoan()
  const createGroup = useCreateLoanGroup()

  const isEditing = !!loan
  const hasPartner = !!partner

  const [amountDisplay, setAmountDisplay] = useState(loan ? loan.original_amount.toString() : '')
  const [balanceDisplay, setBalanceDisplay] = useState(loan ? loan.current_balance.toString() : '')
  const [amortizationDisplay, setAmortizationDisplay] = useState(loan ? loan.monthly_amortization.toString() : '')
  const [rateDisplay, setRateDisplay] = useState(loan ? loan.interest_rate.toString() : '')
  const [groupOpen, setGroupOpen] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [amortizationType, setAmortizationType] = useState<AmortizationType>('fixed')
  const [percentageDisplay, setPercentageDisplay] = useState('')

  const amountInputRef = useRef<HTMLInputElement>(null)
  const groupDropdownRef = useRef<HTMLDivElement>(null)

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      name: loan?.name || '',
      original_amount: loan?.original_amount || 0,
      current_balance: loan?.current_balance || 0,
      interest_rate: loan?.interest_rate || 0,
      monthly_amortization: loan?.monthly_amortization || 0,
      group_id: loan?.group_id || null,
      is_shared: loan?.is_shared || false,
      include_in_budget: (loan as LoanWithBudgetFlag)?.include_in_budget ?? true, // Default to true for new loans
    },
  })

  // Ensure default loan groups exist (deduplicated check built-in)
  const { ensureDefaults } = useEnsureDefaultLoanGroups()
  useEffect(() => {
    if (!groupsLoading && loanGroups) {
      ensureDefaults()
    }
  }, [groupsLoading, loanGroups, ensureDefaults])

  // Watch original amount for syncing
  const watchedOriginalAmount = form.watch('original_amount')
  const watchedCurrentBalance = form.watch('current_balance')

  // Sync current_balance with original_amount for new loans
  useEffect(() => {
    if (!isEditing && watchedOriginalAmount > 0) {
      // For new loans, always sync current_balance to original_amount
      // since new loans haven't been paid down yet
      form.setValue('current_balance', watchedOriginalAmount)
      setBalanceDisplay(watchedOriginalAmount.toString())
    }
  }, [watchedOriginalAmount, isEditing, form])

  // Calculate monthly amortization when percentage mode is active
  useEffect(() => {
    if (amortizationType === 'percentage' && percentageDisplay) {
      const percentage = parseFloat(percentageDisplay.replace(',', '.'))
      const balance = watchedCurrentBalance || watchedOriginalAmount || 0
      if (!isNaN(percentage) && balance > 0) {
        const monthlyAmount = Math.round((balance * percentage) / 100)
        form.setValue('monthly_amortization', monthlyAmount)
        setAmortizationDisplay(monthlyAmount.toString())
      }
    }
  }, [amortizationType, percentageDisplay, watchedCurrentBalance, watchedOriginalAmount, form])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
        setGroupOpen(false)
        setShowNewGroup(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedGroup = loanGroups?.find(g => g.id === form.watch('group_id'))

  const handleAmountChange = (setter: (val: string) => void, field: keyof LoanFormData, isDecimal = false) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '') {
      setter('')
      form.setValue(field, 0 as never)
      return
    }

    if (isDecimal) {
      // Allow decimal input for interest rate
      const cleanValue = value.replace(/[^\d.,]/g, '').replace(',', '.')
      const numValue = parseFloat(cleanValue)
      if (!isNaN(numValue)) {
        setter(cleanValue)
        form.setValue(field, numValue as never)
      }
    } else {
      const numValue = parseInt(value.replace(/\D/g, ''), 10)
      if (!isNaN(numValue)) {
        setter(numValue.toString())
        form.setValue(field, numValue as never)
      }
    }
  }

  const handleGroupSelect = (group: LoanGroup | null) => {
    form.setValue('group_id', group?.id || null)
    setGroupOpen(false)
    setShowNewGroup(false)
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return

    try {
      const newGroup = await createGroup.mutateAsync({
        name: newGroupName.trim(),
        color: LOAN_GROUP_COLORS[Math.floor(Math.random() * LOAN_GROUP_COLORS.length)],
      })
      form.setValue('group_id', newGroup.id)
      setNewGroupName('')
      setShowNewGroup(false)
      setGroupOpen(false)
      toast.success('Lånegrupp skapad!')
    } catch {
      toast.error('Kunde inte skapa lånegrupp')
    }
  }

  async function onSubmit(data: LoanFormData) {
    try {
      if (isEditing) {
        await updateLoan.mutateAsync({
          id: loan.id,
          ...data,
        })
        toast.success('Lån uppdaterat!')
      } else {
        await createLoan.mutateAsync(data)
        toast.success('Lån tillagt!')
      }

      // Reset form for new loans
      if (!isEditing) {
        setAmountDisplay('')
        setBalanceDisplay('')
        setAmortizationDisplay('')
        setRateDisplay('')
        setPercentageDisplay('')
        setAmortizationType('fixed')
        form.reset({
          name: '',
          original_amount: 0,
          current_balance: 0,
          interest_rate: 0,
          monthly_amortization: 0,
          group_id: null,
          is_shared: false,
          include_in_budget: true,
        })
      }

      onSuccess?.()
    } catch {
      toast.error(isEditing ? 'Kunde inte uppdatera lån' : 'Kunde inte lägga till lån')
    }
  }

  const inputStyles = "w-full h-11 px-4 rounded-xl bg-muted text-sm transition-colors focus:outline-none focus:ring-0 focus:border-0"
  const isPending = createLoan.isPending || updateLoan.isPending

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Original Loan Amount - Large centered input */}
      <div className="rounded-xl bg-hb-sage/20 py-5 px-6">
        <p className="text-muted-foreground text-xs text-center mb-2">Lånebelopp</p>
        <div className="flex items-baseline justify-center gap-1">
          <input
            ref={amountInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={amountDisplay}
            onChange={handleAmountChange(setAmountDisplay, 'original_amount')}
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
        {form.formState.errors.original_amount && (
          <p className="text-destructive text-xs mt-2 text-center">
            {form.formState.errors.original_amount.message}
          </p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-muted-foreground text-sm">Namn på lån</Label>
        <input
          id="name"
          placeholder="T.ex. Bolån Nordea, Renovering, etc..."
          {...form.register('name')}
          className={cn(inputStyles, "placeholder:text-muted-foreground/50")}
          style={{ outline: 'none', boxShadow: 'none' }}
        />
        {form.formState.errors.name && (
          <p className="text-destructive text-xs">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      {/* Loan Group Selector */}
      <div className="space-y-2" ref={groupDropdownRef}>
        <Label className="text-muted-foreground text-sm">Typ av lån</Label>
        <div className="relative">
          <div
            className={cn(inputStyles, "flex items-center justify-between cursor-pointer", groupsLoading && "opacity-50")}
            onClick={() => !groupsLoading && setGroupOpen(!groupOpen)}
          >
            <div className="flex items-center gap-2">
              {groupsLoading ? (
                <>
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  <span className="text-muted-foreground/50">Laddar typer...</span>
                </>
              ) : selectedGroup ? (
                <>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedGroup.color }}
                  />
                  <span>{selectedGroup.name}</span>
                </>
              ) : (
                <>
                  <Landmark className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground/50">Välj typ (valfritt)</span>
                </>
              )}
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", groupOpen && "rotate-180")} />
          </div>

          {groupOpen && (
            <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto">
              {/* No group option */}
              <button
                type="button"
                onClick={() => handleGroupSelect(null)}
                className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
              >
                <span className="text-muted-foreground">Ingen typ</span>
                {!form.watch('group_id') && (
                  <Check className="w-4 h-4 text-hb-cognac" />
                )}
              </button>

              {/* Existing groups */}
              {loanGroups?.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleGroupSelect(group)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <div>
                      <span>{group.name}</span>
                      {group.description && (
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      )}
                    </div>
                  </div>
                  {form.watch('group_id') === group.id && (
                    <Check className="w-4 h-4 text-hb-cognac" />
                  )}
                </button>
              ))}

              {/* Add new group */}
              {!showNewGroup ? (
                <button
                  type="button"
                  onClick={() => setShowNewGroup(true)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center gap-2 text-hb-cognac transition-colors border-t"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ny typ</span>
                </button>
              ) : (
                <div className="p-3 border-t space-y-2">
                  <input
                    type="text"
                    placeholder="Namn på ny typ..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-muted"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateGroup()
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowNewGroup(false)
                        setNewGroupName('')
                      }}
                    >
                      Avbryt
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || createGroup.isPending}
                    >
                      {createGroup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Skapa'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Current Balance (only show if editing or different from original) */}
      {isEditing && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Kvarvarande skuld</Label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={balanceDisplay}
              onChange={handleAmountChange(setBalanceDisplay, 'current_balance')}
              className={inputStyles}
              style={{ outline: 'none', boxShadow: 'none' }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr</span>
          </div>
        </div>
      )}

      {/* Interest Rate */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-sm">Ränta</Label>
        <div className="relative">
          <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={rateDisplay}
            onChange={handleAmountChange(setRateDisplay, 'interest_rate', true)}
            className={cn(inputStyles, "pl-10")}
            style={{ outline: 'none', boxShadow: 'none' }}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        </div>
        {form.formState.errors.interest_rate && (
          <p className="text-destructive text-xs">
            {form.formState.errors.interest_rate.message}
          </p>
        )}
      </div>

      {/* Monthly Amortization */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-sm">Månadsamortering</Label>
          {/* Amortization Type Toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setAmortizationType('fixed')}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                amortizationType === 'fixed'
                  ? "bg-white dark:bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Fast belopp
            </button>
            <button
              type="button"
              onClick={() => setAmortizationType('percentage')}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                amortizationType === 'percentage'
                  ? "bg-white dark:bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Procent
            </button>
          </div>
        </div>

        {amortizationType === 'fixed' ? (
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={amortizationDisplay}
              onChange={handleAmountChange(setAmortizationDisplay, 'monthly_amortization')}
              className={inputStyles}
              style={{ outline: 'none', boxShadow: 'none' }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr/mån</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={percentageDisplay}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.')
                  setPercentageDisplay(value)
                }}
                className={cn(inputStyles, "pl-10")}
                style={{ outline: 'none', boxShadow: 'none' }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">% av skuld</span>
            </div>
            {/* Show calculated amount */}
            {amortizationDisplay && parseInt(amortizationDisplay) > 0 && (
              <p className="text-xs text-muted-foreground pl-1">
                = {parseInt(amortizationDisplay).toLocaleString('sv-SE')} kr/mån
              </p>
            )}
          </div>
        )}
      </div>

      {/* Auto-add to Budget */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-hb-sand-deep/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-hb-cognac/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-hb-cognac" />
          </div>
          <div>
            <p className="font-medium text-sm">Lägg till i budget</p>
            <p className="text-xs text-muted-foreground">
              Inkludera amortering och ränta i månadens budget
            </p>
          </div>
        </div>
        <Switch
          checked={form.watch('include_in_budget') ?? true}
          onCheckedChange={(checked) => form.setValue('include_in_budget', checked)}
        />
      </div>

      {/* Share with Partner */}
      {hasPartner && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-hb-sage/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-hb-tim/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-hb-tim" />
            </div>
            <div>
              <p className="font-medium text-sm">Dela med {partner?.first_name || 'partner'}</p>
              <p className="text-xs text-muted-foreground">
                {partner?.first_name || 'Din partner'} kan se och redigera detta lån
              </p>
            </div>
          </div>
          <Switch
            checked={form.watch('is_shared') || false}
            onCheckedChange={(checked) => form.setValue('is_shared', checked)}
          />
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full h-11"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isEditing ? 'Sparar...' : 'Lägger till...'}
          </>
        ) : (
          isEditing ? 'Spara ändringar' : 'Lägg till lån'
        )}
      </Button>
    </form>
  )
}
