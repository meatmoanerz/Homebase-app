'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useCreateCreditCard,
  useUpdateCreditCard,
  useDeleteCreditCard,
  type CreditCard,
} from '@/hooks/use-credit-cards'
import { getInvoicePaymentDate } from '@/lib/utils/credit-cards'
import { cn } from '@/lib/utils/cn'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ArrowLeft, ArrowRight, Check, CreditCard as CardIcon, Loader2, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const ISSUERS: { value: string; label: string; hint: string; breakDate: number; dueDay: number }[] = [
  { value: 'Amex', label: 'American Express', hint: 'CSV från Amex', breakDate: 2, dueDay: 27 },
  { value: 'Norwegian', label: 'Bank Norwegian', hint: 'Excel från Norwegian', breakDate: 15, dueDay: 28 },
  { value: '', label: 'Annat kort', hint: 'Manuella transaktioner', breakDate: 1, dueDay: 25 },
]

interface CreditCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Redigera ett befintligt kort. Utan kort = onboarding av nytt kort. */
  card?: CreditCard | null
  isOnlyCard?: boolean
}

/**
 * Onboarding (och redigering) av ett kreditkort i tre steg:
 * 1. Namn + utgivare  2. Brytdatum + förfallodag  3. Standardkort + sammanfattning
 *
 * Renderar innehållet bara när dialogen är öppen, så varje öppning startar
 * från kortets aktuella värden.
 */
export function CreditCardDialog({ open, onOpenChange, card, isOnlyCard }: CreditCardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {open && (
          <CreditCardDialogBody
            card={card ?? null}
            isOnlyCard={!!isOnlyCard}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CreditCardDialogBody({
  card,
  isOnlyCard,
  onDone,
}: {
  card: CreditCard | null
  isOnlyCard: boolean
  onDone: () => void
}) {
  const isEdit = !!card
  const createCard = useCreateCreditCard()
  const updateCard = useUpdateCreditCard()
  const deleteCard = useDeleteCreditCard()

  const [step, setStep] = useState(0)
  const [name, setName] = useState(card?.name ?? '')
  const [issuer, setIssuer] = useState<string>(card?.issuer ?? '')
  const [breakDate, setBreakDate] = useState(String(card?.invoice_break_date ?? 1))
  const [dueDay, setDueDay] = useState(String(card?.due_day ?? 25))
  const [isDefault, setIsDefault] = useState(card?.is_default ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saving = createCard.isPending || updateCard.isPending

  const pickIssuer = (value: string) => {
    setIssuer(value)
    const preset = ISSUERS.find(i => i.value === value)
    if (!preset) return
    if (!name.trim() && value) setName(value)
    if (!isEdit) {
      setBreakDate(String(preset.breakDate))
      setDueDay(String(preset.dueDay))
    }
  }

  // Exempel: fakturan som bryts i nästa månad
  const example = (() => {
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const pay = getInvoicePaymentDate(period, { invoice_break_date: Number(breakDate), due_day: Number(dueDay) })
    const breakDay = Number(breakDate)
    return {
      from: format(new Date(now.getFullYear(), now.getMonth() - 1, breakDay), 'd MMM', { locale: sv }),
      to: format(new Date(now.getFullYear(), now.getMonth(), breakDay - 1), 'd MMM', { locale: sv }),
      pay: format(pay, 'd MMM', { locale: sv }),
    }
  })()

  const handleSave = async () => {
    const input = {
      name: name.trim(),
      issuer: issuer || null,
      invoice_break_date: Number(breakDate),
      due_day: Number(dueDay),
      is_default: isDefault,
    }
    try {
      if (card) {
        await updateCard.mutateAsync({ id: card.id, ...input })
        toast.success('Kortet uppdaterat')
      } else {
        await createCard.mutateAsync(input)
        toast.success(`${input.name} tillagt`)
      }
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara kortet')
    }
  }

  const handleDelete = async () => {
    if (!card) return
    try {
      await deleteCard.mutateAsync(card.id)
      toast.success(`${card.name} borttaget`)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunde inte ta bort kortet')
      setConfirmDelete(false)
    }
  }

  const steps = ['Kort', 'Faktura', 'Klart']

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CardIcon className="w-5 h-5 text-hb-terracotta" />
          {isEdit ? `Redigera ${card?.name}` : 'Lägg till kreditkort'}
        </DialogTitle>
        <DialogDescription>
          {step === 0 && 'Namnge kortet och välj utgivare'}
          {step === 1 && 'När bryts och betalas fakturan?'}
          {step === 2 && 'Kontrollera och spara'}
        </DialogDescription>
      </DialogHeader>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-hb-terracotta' : 'bg-muted')} />
            <p className={cn('text-[10px] mt-1', i === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>{label}</p>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Utgivare</Label>
            <div className="grid grid-cols-3 gap-2">
              {ISSUERS.map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => pickIssuer(opt.value)}
                  className={cn(
                    'p-2.5 rounded-xl border-2 text-left transition-colors',
                    issuer === opt.value ? 'border-hb-terracotta bg-hb-terracotta/10' : 'border-border hover:bg-muted/50'
                  )}
                >
                  <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-name">Namn på kortet</Label>
            <Input
              id="card-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="t.ex. Amex eller Norwegian"
              maxLength={40}
              autoFocus={!isEdit}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Brytdatum</Label>
            <Select value={breakDate} onValueChange={setBreakDate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                  <SelectItem key={day} value={String(day)}>Den {day}:e varje månad</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Köp från och med detta datum hamnar på nästa faktura</p>
          </div>
          <div className="space-y-2">
            <Label>Förfallodag</Label>
            <Select value={dueDay} onValueChange={setDueDay}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <SelectItem key={day} value={String(day)}>Den {day}:e</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Styr vilken budgetperiod fakturan hämtas till</p>
          </div>
          <div className="p-3 rounded-lg bg-hb-sand-deep/20 text-xs text-muted-foreground">
            Exempel: köp {example.from} – {example.to} betalas <span className="font-medium text-foreground">{example.pay}</span>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/40 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Namn</span><span className="font-medium">{name.trim()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Utgivare</span><span className="font-medium">{ISSUERS.find(i => i.value === issuer)?.label}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Brytdatum</span><span className="font-medium">Den {breakDate}:e</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Förfallodag</span><span className="font-medium">Den {dueDay}:e</span></div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-hb-sand-deep/20">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-hb-terracotta" />
              <div>
                <Label htmlFor="card-default" className="text-sm font-medium">Standardkort</Label>
                <p className="text-xs text-muted-foreground">CCM-markerade köp hamnar här</p>
              </div>
            </div>
            <Switch
              id="card-default"
              checked={isDefault || isOnlyCard}
              disabled={isOnlyCard || (isEdit && card?.is_default)}
              onCheckedChange={setIsDefault}
            />
          </div>

          {isEdit && (
            confirmDelete ? (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                <p className="text-sm">Ta bort {card?.name}? Fakturabelopp för kortet tas också bort.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmDelete(false)}>Avbryt</Button>
                  <Button variant="destructive" size="sm" className="flex-1" onClick={handleDelete} disabled={deleteCard.isPending}>
                    {deleteCard.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ta bort'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Ta bort kortet
              </Button>
            )
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Tillbaka
          </Button>
        )}
        {step < 2 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !name.trim()} className="flex-1">
            Nästa
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 bg-hb-terracotta hover:bg-hb-terracotta/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Check className="w-4 h-4 mr-1" />{isEdit ? 'Spara' : 'Lägg till kort'}</>)}
          </Button>
        )}
      </div>
    </>
  )
}
