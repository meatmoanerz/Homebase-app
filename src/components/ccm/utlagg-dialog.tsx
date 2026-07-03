'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { usePartner } from '@/hooks/use-user'
import { useCategories } from '@/hooks/use-categories'
import { useCreateUtlagg, useUpdateUtlagg } from '@/hooks/use-utlagg'
import { CategoryCombobox } from '@/components/import/category-combobox'
import { formatCurrency } from '@/lib/utils/formatters'
import { format } from 'date-fns'
import { HandCoins, Loader2, Minus, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ExpenseWithCategory } from '@/types'

export interface UtlaggSplit {
  userShare: number
  partnerShare: number
  swishRecipient: 'user' | 'partner' | 'shared'
}

type Preset = 'full' | 'divide' | 'custom'

function parseAmount(v: string): number {
  const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function toInputString(n: number): string {
  if (!n) return ''
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
}

export function isSplitValid(total: number, split: UtlaggSplit): boolean {
  return total > 0 && total - split.userShare - split.partnerShare >= -0.004
}

/**
 * Shared split editor: given a total paid on the card, decide how much
 * belongs in our budget (my share / partner share) and how much is
 * "utlägg" — money laid out for others that comes back via Swish and
 * therefore stays outside the budget.
 *
 * NOTE: initializes its local inputs from `value` on mount. Parents render
 * it inside dialog content that unmounts on close, so a fresh mount per
 * dialog opening keeps everything in sync without effects.
 */
export function UtlaggSplitEditor({
  total,
  partnerName,
  value,
  onChange,
}: {
  total: number
  partnerName: string | null
  value: UtlaggSplit
  onChange: (split: UtlaggSplit) => void
}) {
  const [preset, setPreset] = useState<Preset>(
    value.userShare === 0 && value.partnerShare === 0 ? 'full' : 'custom'
  )
  const [divideCount, setDivideCount] = useState(2)
  const [userInput, setUserInput] = useState(toInputString(value.userShare))
  const [partnerInput, setPartnerInput] = useState(toInputString(value.partnerShare))

  const swishAmount = Math.round((total - value.userShare - value.partnerShare) * 100) / 100
  const budgetAmount = Math.round((value.userShare + value.partnerShare) * 100) / 100
  const invalid = swishAmount < -0.004

  const applyFull = () => {
    setPreset('full')
    setUserInput('')
    setPartnerInput('')
    onChange({ ...value, userShare: 0, partnerShare: 0 })
  }

  const applyDivide = (count: number) => {
    setPreset('divide')
    setDivideCount(count)
    const share = Math.round((total / count) * 100) / 100
    setUserInput(toInputString(share))
    setPartnerInput('')
    onChange({ ...value, userShare: share, partnerShare: 0 })
  }

  const handleUserInput = (v: string) => {
    setPreset('custom')
    setUserInput(v)
    onChange({ ...value, userShare: parseAmount(v) })
  }

  const handlePartnerInput = (v: string) => {
    setPreset('custom')
    setPartnerInput(v)
    onChange({ ...value, partnerShare: parseAmount(v) })
  }

  return (
    <div className="space-y-4">
      {/* Quick presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Snabbval</Label>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={applyFull}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              preset === 'full'
                ? 'bg-hb-cognac text-white border-hb-cognac'
                : 'bg-secondary border-border text-muted-foreground hover:border-hb-cognac/50'
            )}
          >
            Helt utlägg
          </button>
          <div
            className={cn(
              'flex items-center gap-0.5 rounded-full border transition-colors',
              preset === 'divide'
                ? 'bg-hb-cognac text-white border-hb-cognac'
                : 'bg-secondary border-border text-muted-foreground'
            )}
          >
            <button
              type="button"
              onClick={() => applyDivide(preset === 'divide' ? Math.max(2, divideCount - 1) : divideCount)}
              className="pl-2.5 pr-1 py-1.5"
              aria-label="Färre personer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => applyDivide(divideCount)}
              className="text-xs font-medium py-1.5"
            >
              Dela på {divideCount}
            </button>
            <button
              type="button"
              onClick={() => applyDivide(preset === 'divide' ? Math.min(12, divideCount + 1) : divideCount)}
              className="pl-1 pr-2.5 py-1.5"
              aria-label="Fler personer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {preset === 'full' && 'Hela beloppet swishas tillbaka — inget belastar budgeten.'}
          {preset === 'divide' && `Din del blir ${formatCurrency(Math.round((total / divideCount) * 100) / 100)}, resten är utlägg.`}
          {preset === 'custom' && 'Ange exakta belopp nedan.'}
        </p>
      </div>

      {/* Amount fields */}
      <div className={cn('grid gap-3', partnerName ? 'grid-cols-2' : 'grid-cols-1')}>
        <div className="space-y-1.5">
          <Label className="text-xs">Min del</Label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={userInput}
              onChange={(e) => handleUserInput(e.target.value)}
              placeholder="0"
              className="w-full h-10 px-3 pr-8 rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors text-sm font-medium"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kr</span>
          </div>
        </div>
        {partnerName && (
          <div className="space-y-1.5">
            <Label className="text-xs">{partnerName}s del</Label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={partnerInput}
                onChange={(e) => handlePartnerInput(e.target.value)}
                placeholder="0"
                className="w-full h-10 px-3 pr-8 rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors text-sm font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kr</span>
            </div>
          </div>
        )}
      </div>

      {/* Auto-calculated utlägg + validation */}
      {invalid ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Delarna överstiger totalbeloppet med {formatCurrency(Math.abs(swishAmount))}
        </div>
      ) : (
        <div className="bg-hb-sand/20 border border-hb-sand/40 rounded-xl px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">I budget</span>
            <span className="font-medium">{formatCurrency(budgetAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Utlägg (utanför budget)</span>
            <span className="font-serif font-medium text-hb-cognac-deep">{formatCurrency(swishAmount)}</span>
          </div>
        </div>
      )}

      {/* Swish recipient — only relevant when there is an utlägg and a partner */}
      {swishAmount > 0.004 && partnerName && (
        <div className="space-y-1.5">
          <Label className="text-xs">Vem får Swish-pengarna?</Label>
          <div className="flex gap-1.5 bg-secondary rounded-full p-1">
            {([
              { v: 'user' as const, label: 'Jag' },
              { v: 'partner' as const, label: partnerName },
              { v: 'shared' as const, label: 'Delas 50/50' },
            ]).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => onChange({ ...value, swishRecipient: o.v })}
                className={cn(
                  'flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all',
                  value.swishRecipient === o.v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Den som tar emot Swish betalar utläggsdelen när fakturan dras.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Standalone dialog used on the CCM page: create or edit an utlägg
 * (a card purchase partly or fully laid out for others).
 * The inner form mounts fresh on every open (Radix unmounts closed content),
 * so state initializes directly from props — no sync effects needed.
 */
export function UtlaggDialog({
  open,
  onOpenChange,
  editExpense,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editExpense?: ExpenseWithCategory | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-hb-cognac" />
            {editExpense ? 'Redigera utlägg' : 'Registrera utlägg'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Kortköp där andra swishar dig — bara din del hamnar i budgeten
          </p>
        </DialogHeader>
        <UtlaggForm editExpense={editExpense} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function UtlaggForm({
  editExpense,
  onDone,
}: {
  editExpense?: ExpenseWithCategory | null
  onDone: () => void
}) {
  const { data: partner } = usePartner()
  const { data: categories = [] } = useCategories()
  const createUtlagg = useCreateUtlagg()
  const updateUtlagg = useUpdateUtlagg()
  const isEditMode = !!editExpense

  const [totalInput, setTotalInput] = useState(() =>
    editExpense ? toInputString(editExpense.group_purchase_total || editExpense.amount) : ''
  )
  const [description, setDescription] = useState(editExpense?.description ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(editExpense?.category_id ?? null)
  const [date, setDate] = useState(editExpense?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [split, setSplit] = useState<UtlaggSplit>(() => ({
    userShare: editExpense?.group_purchase_user_share || 0,
    partnerShare: editExpense?.group_purchase_partner_share || 0,
    swishRecipient:
      (editExpense?.group_purchase_swish_recipient as UtlaggSplit['swishRecipient']) || 'user',
  }))

  const amountInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!isEditMode) {
      const t = setTimeout(() => amountInputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [isEditMode])

  const total = parseAmount(totalInput)
  const partnerName = partner?.first_name ?? null
  const canSave = total > 0 && description.length > 0 && !!categoryId && isSplitValid(total, split)
  const isPending = createUtlagg.isPending || updateUtlagg.isPending

  const handleSubmit = async () => {
    if (!canSave || !categoryId) return
    try {
      const payload = {
        totalAmount: total,
        description,
        category_id: categoryId,
        date,
        userShare: split.userShare,
        partnerShare: split.partnerShare,
        swishRecipient: split.swishRecipient,
      }
      if (isEditMode && editExpense) {
        await updateUtlagg.mutateAsync({ id: editExpense.id, ...payload })
      } else {
        await createUtlagg.mutateAsync(payload)
      }
      onDone()
    } catch {
      // Error handled in mutation hook
    }
  }

  return (
    <div className="space-y-5">
      {/* Total */}
      <div className="space-y-2">
        <Label>Totalt på kortet</Label>
        <div className="relative">
          <input
            ref={amountInputRef}
            type="text"
            inputMode="decimal"
            value={totalInput}
            onChange={(e) => setTotalInput(e.target.value)}
            placeholder="0"
            className="w-full h-14 px-4 text-2xl font-bold rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">kr</span>
        </div>
      </div>

      {/* Description + date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Beskrivning</Label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="T.ex. Flygbiljetter"
            className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Datum</Label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors text-sm"
          />
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label className="text-xs">Kategori</Label>
        <CategoryCombobox
          value={categoryId}
          categories={categories}
          onChange={setCategoryId}
          placeholder="Välj kategori…"
          className="w-full"
        />
      </div>

      {/* Split */}
      {total > 0 && (
        <div className="border-t border-border pt-4">
          <UtlaggSplitEditor
            total={total}
            partnerName={partnerName}
            value={split}
            onChange={setSplit}
          />
        </div>
      )}

      <Button onClick={handleSubmit} disabled={!canSave || isPending} className="w-full">
        {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {isEditMode ? 'Spara ändringar' : 'Spara utlägg'}
      </Button>
    </div>
  )
}

/**
 * Lightweight split dialog used in the import flow: the transaction
 * (total + description) is fixed, we only decide the split.
 */
export function UtlaggSplitDialog({
  open,
  onOpenChange,
  total,
  description,
  partnerName,
  initial,
  onSave,
  onRemove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  description: string
  partnerName: string | null
  initial: UtlaggSplit | null
  onSave: (split: UtlaggSplit) => void
  onRemove?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-hb-cognac" />
            Markera som utlägg
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">
            {description} · {formatCurrency(total)}
          </p>
        </DialogHeader>
        <UtlaggSplitForm
          total={total}
          partnerName={partnerName}
          initial={initial}
          onSave={(split) => {
            onSave(split)
            onOpenChange(false)
          }}
          onRemove={
            initial && onRemove
              ? () => {
                  onRemove()
                  onOpenChange(false)
                }
              : undefined
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function UtlaggSplitForm({
  total,
  partnerName,
  initial,
  onSave,
  onRemove,
}: {
  total: number
  partnerName: string | null
  initial: UtlaggSplit | null
  onSave: (split: UtlaggSplit) => void
  onRemove?: () => void
}) {
  const [split, setSplit] = useState<UtlaggSplit>(
    () => initial ?? { userShare: 0, partnerShare: 0, swishRecipient: 'user' }
  )
  const valid = isSplitValid(total, split)

  return (
    <div className="space-y-5">
      <UtlaggSplitEditor total={total} partnerName={partnerName} value={split} onChange={setSplit} />
      <div className="flex gap-2">
        {onRemove && (
          <Button
            variant="outline"
            onClick={onRemove}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Ta bort
          </Button>
        )}
        <Button onClick={() => onSave(split)} disabled={!valid} className="flex-1">
          Spara utlägg
        </Button>
      </div>
    </div>
  )
}
