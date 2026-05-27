'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateSavingsGoal } from '@/hooks/use-savings-goals'
import { useCustomGoalTypes, useCreateCustomGoalType } from '@/hooks/use-custom-goal-types'
import { usePartner } from '@/hooks/use-user'
import { toast } from 'sonner'
import { Loader2, ChevronDown, Check, Target, Wallet, Calendar, PiggyBank, Plus, X } from 'lucide-react'
import { format, addMonths } from 'date-fns'
import { sv } from 'date-fns/locale'
import { cn } from '@/lib/utils/cn'
import type { GoalCategory, CustomGoalType } from '@/types'

const defaultGoalCategoryIcons: Record<GoalCategory, string> = {
  emergency: '🛡️',
  vacation: '✈️',
  home: '🏠',
  car: '🚗',
  education: '📚',
  retirement: '👴',
  other: '🎯',
}

const defaultGoalCategoryLabels: Record<GoalCategory, string> = {
  emergency: 'Buffert',
  vacation: 'Semester',
  home: 'Boende',
  car: 'Bil',
  education: 'Utbildning',
  retirement: 'Pension',
  other: 'Övrigt',
}

const savingsGoalSchema = z.object({
  name: z.string().min(1, 'Namn krävs'),
  description: z.string().optional(),
  target_amount: z.number().positive('Målbelopp måste vara positivt'),
  target_date: z.string().optional(),
  starting_balance: z.number().min(0, 'Kan inte vara negativt'),
  monthly_savings_enabled: z.boolean(),
  monthly_savings_amount: z.number().min(0),
  goal_category: z.enum(['emergency', 'vacation', 'home', 'car', 'education', 'retirement', 'other']),
  custom_goal_type_id: z.string().nullable(),
  is_shared: z.boolean(),
})

type SavingsGoalFormData = z.infer<typeof savingsGoalSchema>

interface SavingsGoalFormProps {
  onSuccess?: () => void
}

export function SavingsGoalForm({ onSuccess }: SavingsGoalFormProps) {
  const { data: partner } = usePartner()
  const { data: customGoalTypes = [] } = useCustomGoalTypes()
  const createGoal = useCreateSavingsGoal()
  const createCustomType = useCreateCustomGoalType()
  const hasPartner = !!partner

  const [amountDisplay, setAmountDisplay] = useState('')
  const [startingDisplay, setStartingDisplay] = useState('')
  const [monthlyDisplay, setMonthlyDisplay] = useState('')
  const [goalTypeOpen, setGoalTypeOpen] = useState(false)
  const [showAddCustomType, setShowAddCustomType] = useState(false)
  const [newCustomTypeName, setNewCustomTypeName] = useState('')
  const [newCustomTypeIcon, setNewCustomTypeIcon] = useState('🎯')

  const amountInputRef = useRef<HTMLInputElement>(null)
  const goalTypeDropdownRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<SavingsGoalFormData>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues: {
      name: '',
      description: '',
      target_amount: 0,
      target_date: format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
      starting_balance: 0,
      monthly_savings_enabled: false,
      monthly_savings_amount: 0,
      goal_category: 'other',
      custom_goal_type_id: null,
      is_shared: false,
    },
  })

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (goalTypeDropdownRef.current && !goalTypeDropdownRef.current.contains(event.target as Node)) {
        setGoalTypeOpen(false)
        setShowAddCustomType(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedGoalCategory = form.watch('goal_category')
  const selectedCustomTypeId = form.watch('custom_goal_type_id')
  const selectedCustomType = customGoalTypes.find(t => t.id === selectedCustomTypeId)

  const handleAmountChange = (setter: (val: string) => void, field: keyof SavingsGoalFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '') {
      setter('')
      form.setValue(field, 0 as never)
      return
    }
    const numValue = parseInt(value.replace(/\D/g, ''), 10)
    if (!isNaN(numValue)) {
      setter(numValue.toString())
      form.setValue(field, numValue as never)
    }
  }

  const handleGoalCategorySelect = (goalCategory: GoalCategory) => {
    form.setValue('goal_category', goalCategory)
    form.setValue('custom_goal_type_id', null)
    setGoalTypeOpen(false)
    setShowAddCustomType(false)
  }

  const handleCustomTypeSelect = (customType: CustomGoalType) => {
    form.setValue('custom_goal_type_id', customType.id)
    form.setValue('goal_category', 'other') // Set to other when using custom type
    setGoalTypeOpen(false)
    setShowAddCustomType(false)
  }

  const handleAddCustomType = async () => {
    if (!newCustomTypeName.trim()) return

    try {
      const newType = await createCustomType.mutateAsync({
        name: newCustomTypeName.trim(),
        icon: newCustomTypeIcon,
      })
      handleCustomTypeSelect(newType)
      setNewCustomTypeName('')
      setNewCustomTypeIcon('🎯')
      toast.success('Ny måltyp skapad!')
    } catch {
      toast.error('Kunde inte skapa måltyp')
    }
  }

  const formatDisplayDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return format(date, 'd MMMM yyyy', { locale: sv })
    } catch {
      return dateStr
    }
  }

  const getSelectedTypeDisplay = () => {
    if (selectedCustomType) {
      return {
        icon: selectedCustomType.icon,
        label: selectedCustomType.name,
      }
    }
    return {
      icon: defaultGoalCategoryIcons[selectedGoalCategory],
      label: defaultGoalCategoryLabels[selectedGoalCategory],
    }
  }

  const typeDisplay = getSelectedTypeDisplay()

  async function onSubmit(data: SavingsGoalFormData) {
    try {
      await createGoal.mutateAsync({
        name: data.name,
        description: data.description,
        target_amount: data.target_amount,
        target_date: data.target_date,
        starting_balance: data.starting_balance,
        monthly_savings_enabled: data.monthly_savings_enabled,
        monthly_savings_amount: data.monthly_savings_amount,
        goal_category: data.goal_category,
        custom_goal_type_id: data.custom_goal_type_id,
        is_shared: data.is_shared,
      })
      toast.success('Sparmål skapat!')

      // Reset form
      setAmountDisplay('')
      setStartingDisplay('')
      setMonthlyDisplay('')
      form.reset({
        name: '',
        description: '',
        target_amount: 0,
        target_date: format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
        starting_balance: 0,
        monthly_savings_enabled: false,
        monthly_savings_amount: 0,
        goal_category: 'other',
        custom_goal_type_id: null,
        is_shared: false,
      })

      onSuccess?.()
    } catch {
      toast.error('Kunde inte skapa sparmål')
    }
  }

  const inputStyles = "w-full h-11 px-4 rounded-xl bg-muted text-sm transition-colors focus:outline-none focus:ring-0 focus:border-0"

  const commonIcons = ['🎯', '💰', '🏖️', '🎓', '💍', '🎁', '🏋️', '🎮', '📱', '💻', '🎵', '🎨']

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Target Amount - Large centered input */}
      <div className="rounded-xl bg-hb-sage/20 py-5 px-6">
        <p className="text-muted-foreground text-xs text-center mb-2">Målbelopp</p>
        <div className="flex items-baseline justify-center gap-1">
          <input
            ref={amountInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={amountDisplay}
            onChange={handleAmountChange(setAmountDisplay, 'target_amount')}
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
        {form.formState.errors.target_amount && (
          <p className="text-destructive text-xs mt-2 text-center">
            {form.formState.errors.target_amount.message}
          </p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-muted-foreground text-sm">Namn på sparmål</Label>
        <input
          id="name"
          placeholder="T.ex. Thailand 2027, Buffert, Ny bil..."
          {...form.register('name')}
          className={cn(inputStyles, "placeholder:text-muted-foreground/50")}
          style={{ outline: 'none', boxShadow: 'none' }}
        />
        {form.formState.errors.name && (
          <p className="text-destructive text-xs">
            {form.formState.errors.name.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          En kategori med detta namn skapas automatiskt
        </p>
      </div>

      {/* Goal Type Selector with Custom Types */}
      <div className="space-y-2" ref={goalTypeDropdownRef}>
        <Label className="text-muted-foreground text-sm">Typ av sparmål</Label>
        <div className="relative">
          <div
            className={cn(inputStyles, "flex items-center justify-between cursor-pointer")}
            onClick={() => setGoalTypeOpen(!goalTypeOpen)}
          >
            <div className="flex items-center gap-2">
              <span>{typeDisplay.icon}</span>
              <span>{typeDisplay.label}</span>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", goalTypeOpen && "rotate-180")} />
          </div>

          {goalTypeOpen && (
            <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-80 overflow-y-auto">
              {/* Default categories */}
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                Standardtyper
              </div>
              {(Object.keys(defaultGoalCategoryLabels) as GoalCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleGoalCategorySelect(cat)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>{defaultGoalCategoryIcons[cat]}</span>
                    <span>{defaultGoalCategoryLabels[cat]}</span>
                  </div>
                  {selectedGoalCategory === cat && !selectedCustomTypeId && (
                    <Check className="w-4 h-4 text-hb-cognac" />
                  )}
                </button>
              ))}

              {/* Custom types */}
              {customGoalTypes.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                    Egna typer
                  </div>
                  {customGoalTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleCustomTypeSelect(type)}
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <span>{type.name}</span>
                      </div>
                      {selectedCustomTypeId === type.id && (
                        <Check className="w-4 h-4 text-hb-cognac" />
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* Add new custom type */}
              <div className="border-t">
                {!showAddCustomType ? (
                  <button
                    type="button"
                    onClick={() => setShowAddCustomType(true)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center gap-2 text-hb-cognac transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Lägg till egen typ</span>
                  </button>
                ) : (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Namn på typ"
                        value={newCustomTypeName}
                        onChange={(e) => setNewCustomTypeName(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-lg bg-muted text-sm"
                        style={{ outline: 'none' }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddCustomType(false)
                          setNewCustomTypeName('')
                        }}
                        className="p-2 hover:bg-muted rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {commonIcons.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setNewCustomTypeIcon(icon)}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all",
                            newCustomTypeIcon === icon
                              ? "bg-hb-sage/30 ring-2 ring-hb-cognac"
                              : "bg-muted hover:bg-muted/80"
                          )}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={handleAddCustomType}
                      disabled={!newCustomTypeName.trim() || createCustomType.isPending}
                    >
                      {createCustomType.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Skapa typ
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Target Date */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-sm">Måldatum (valfritt)</Label>
        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker?.()}
          className={cn(inputStyles, "text-left cursor-pointer flex items-center gap-2")}
        >
          <Calendar className="w-4 h-4 text-muted-foreground" />
          {form.watch('target_date') ? formatDisplayDate(form.watch('target_date')!) : 'Välj datum'}
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={form.watch('target_date') || ''}
          onChange={(e) => form.setValue('target_date', e.target.value)}
          className="sr-only"
        />
      </div>

      {/* Starting Balance */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-sm">Redan sparat</Label>
        <div className="relative">
          <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={startingDisplay}
            onChange={handleAmountChange(setStartingDisplay, 'starting_balance')}
            className={cn(inputStyles, "pl-10")}
            style={{ outline: 'none', boxShadow: 'none' }}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr</span>
        </div>
      </div>

      {/* Monthly Savings Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-hb-sand-deep/20">
        <div className="flex items-center gap-3">
          <PiggyBank className="w-5 h-5 text-hb-terracotta" />
          <div>
            <Label htmlFor="monthly_savings" className="text-sm font-medium">
              Månadssparande
            </Label>
            <p className="text-xs text-muted-foreground">
              Spara automatiskt varje månad
            </p>
          </div>
        </div>
        <Switch
          id="monthly_savings"
          checked={form.watch('monthly_savings_enabled')}
          onCheckedChange={(checked) => form.setValue('monthly_savings_enabled', checked)}
        />
      </div>

      {/* Monthly Amount (if enabled) */}
      {form.watch('monthly_savings_enabled') && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Belopp per månad</Label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={monthlyDisplay}
              onChange={handleAmountChange(setMonthlyDisplay, 'monthly_savings_amount')}
              className={inputStyles}
              style={{ outline: 'none', boxShadow: 'none' }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr/mån</span>
          </div>
        </div>
      )}

      {/* Shared with Partner */}
      {hasPartner && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-hb-tim/10">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-hb-tim" />
            <div>
              <Label htmlFor="is_shared" className="text-sm font-medium">
                Dela med partner
              </Label>
              <p className="text-xs text-muted-foreground">
                Spara tillsammans mot samma mål
              </p>
            </div>
          </div>
          <Switch
            id="is_shared"
            checked={form.watch('is_shared')}
            onCheckedChange={(checked) => form.setValue('is_shared', checked)}
          />
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full h-11"
        disabled={createGoal.isPending}
      >
        {createGoal.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sparar...
          </>
        ) : (
          'Skapa sparmål'
        )}
      </Button>
    </form>
  )
}
