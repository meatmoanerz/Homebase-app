'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MealsAccessGate } from '@/components/meals/meals-access-gate'
import { MealsPageSkeleton } from '@/components/meals/meals-skeleton'
import {
  DEFAULT_MEAL_SETTINGS,
  useAddMealStore,
  useMealSettings,
  useMealStores,
  useSaveMealSettings,
} from '@/hooks/use-meals'
import { MEMBERSHIP_LABELS } from '@/lib/meals/prompt'
import type { MealSettings, MealStore, Membership } from '@/types/meals'

type SettingsForm = Omit<MealSettings, 'user_id'>

const CHAINS = ['ICA', 'Willys', 'Coop', 'Hemköp', 'Lidl', 'City Gross', 'Annan']

const OFFERS_SOURCE_BY_CHAIN: Record<string, string> = {
  Willys: 'willys_api',
  Hemköp: 'willys_api',
  ICA: 'ica_web',
  Coop: 'coop_web',
}

export default function MealSettingsPage() {
  return (
    <MealsAccessGate>
      <MealSettingsLoader />
    </MealsAccessGate>
  )
}

function MealSettingsLoader() {
  const { data, isLoading } = useMealSettings()
  if (isLoading || !data) return <MealsPageSkeleton />
  const source = data.settings ?? { user_id: '', ...DEFAULT_MEAL_SETTINGS }
  const initial: SettingsForm = { ...DEFAULT_MEAL_SETTINGS }
  for (const key of Object.keys(DEFAULT_MEAL_SETTINGS) as (keyof SettingsForm)[]) {
    ;(initial as Record<string, unknown>)[key] = source[key]
  }
  return <MealSettingsForm initial={initial} inherited={data.inherited} />
}

function MealSettingsForm({ initial, inherited }: { initial: SettingsForm; inherited: boolean }) {
  const router = useRouter()
  const { data: stores = [] } = useMealStores()
  const save = useSaveMealSettings()
  const [form, setForm] = useState<SettingsForm>(initial)
  const [avoidText, setAvoidText] = useState(initial.avoid.join(', '))
  const [pantryText, setPantryText] = useState(initial.pantry_staples.join(', '))

  function set<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleMembership(m: Membership, on: boolean) {
    set('memberships', on ? [...new Set([...form.memberships, m])] : form.memberships.filter((x) => x !== m))
  }

  function toggleStore(id: string, on: boolean) {
    set('preferred_store_ids', on ? [...new Set([...form.preferred_store_ids, id])] : form.preferred_store_ids.filter((x) => x !== id))
  }

  function setFee(id: string, value: string) {
    const fees = { ...form.online_fees }
    const n = Number(value.replace(',', '.'))
    if (value.trim() === '' || Number.isNaN(n)) delete fees[id]
    else fees[id] = n
    set('online_fees', fees)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const list = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean)
    save.mutate({ ...form, avoid: list(avoidText), pantry_staples: list(pantryText) }, { onSuccess: () => router.push('/meals') })
  }

  return (
    <form onSubmit={submit} className="px-4 md:px-8 pt-2 md:pt-4 pb-8 space-y-4 max-w-3xl mx-auto">
      <div className="hidden md:flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Tillbaka">
          <Link href="/meals">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="font-serif text-[28px] font-medium tracking-tight">Inställningar för veckomat</h1>
      </div>

      {inherited && (
        <p className="rounded-2xl bg-hb-sage/15 px-4 py-3 text-[13px]">
          Fälten utgår från din partners inställningar. När du sparar blir de dina egna.
        </p>
      )}

      <Card title="Hushåll" description="Barnportion räknas som ungefär en halv vuxenportion">
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="adults" label="Vuxna" value={form.adults} onChange={(v) => set('adults', v)} />
          <NumberField id="kids" label="Barn" value={form.kids} onChange={(v) => set('kids', v)} />
          <NumberField
            id="portions"
            label="Vuxenportioner per middag"
            value={form.portions_per_dinner}
            step={0.5}
            onChange={(v) => set('portions_per_dinner', v)}
          />
          <NumberField id="dinners" label="Middagar per vecka" value={form.dinners_per_week} onChange={(v) => set('dinners_per_week', v)} />
          <NumberField
            id="boxes"
            label="Matlådor per vecka"
            value={form.lunchboxes_per_week}
            onChange={(v) => set('lunchboxes_per_week', v)}
          />
        </div>
      </Card>

      <Card title="Mat" description="Det här följer med i startprompten till Claude">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="kcal-min"
              label="Kcal per vuxenportion, från"
              value={form.kcal_target_min}
              optional
              onChange={(v) => set('kcal_target_min', v)}
            />
            <NumberField
              id="kcal-max"
              label="till"
              value={form.kcal_target_max}
              optional
              onChange={(v) => set('kcal_target_max', v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diet">Önskemål</Label>
            <textarea
              id="diet"
              rows={3}
              value={form.diet_notes ?? ''}
              onChange={(e) => set('diet_notes', e.target.value || null)}
              placeholder="T.ex. äter allt, gärna kalorisnålt, barnvänligt"
              className="w-full rounded-2xl border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avoid">Undvik</Label>
            <Input id="avoid" value={avoidText} onChange={(e) => setAvoidText(e.target.value)} placeholder="T.ex. svamp, koriander" />
            <p className="text-[11px] text-muted-foreground">Separera med kommatecken</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pantry">Basvaror som alltid finns hemma</Label>
            <Input
              id="pantry"
              value={pantryText}
              onChange={(e) => setPantryText(e.target.value)}
              placeholder="T.ex. olja, salt, peppar, buljong, ris, pasta"
            />
            <p className="text-[11px] text-muted-foreground">
              Hamnar aldrig på inköpslistan. Det som bara finns hemma just den här veckan skriver du på Veckomat-sidan.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Medlemskap" description="Medlemspriser räknas bara med för de program du är med i">
        <div className="space-y-2">
          {(Object.keys(MEMBERSHIP_LABELS) as Membership[]).map((m) => (
            <label key={m} htmlFor={`m-${m}`} className="flex items-center gap-3 text-[14px] cursor-pointer">
              <Checkbox
                id={`m-${m}`}
                checked={form.memberships.includes(m)}
                onCheckedChange={(v) => toggleMembership(m, v === true)}
                className="h-5 w-5"
              />
              {MEMBERSHIP_LABELS[m]}
            </label>
          ))}
        </div>
      </Card>

      <Card title="Butiker" description="Butikerna Claude jämför erbjudanden i. Avgift gäller vid onlinehandel.">
        {stores.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Inga butiker än. Lägg till en nedan.</p>
        ) : (
          <ul className="divide-y divide-border">
            {stores.map((s) => (
              <StoreRow
                key={s.id}
                store={s}
                checked={form.preferred_store_ids.includes(s.id)}
                fee={form.online_fees[s.id]}
                onToggle={(on) => toggleStore(s.id, on)}
                onFee={(v) => setFee(s.id, v)}
              />
            ))}
          </ul>
        )}
        <AddStore onAdded={(s) => toggleStore(s.id, true)} />
      </Card>

      <div className="flex gap-2 justify-end">
        <Button asChild variant="ghost">
          <Link href="/meals">Avbryt</Link>
        </Button>
        <Button type="submit" disabled={save.isPending}>
          Spara
        </Button>
      </div>
    </form>
  )
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm space-y-3">
      <div>
        <h2 className="font-serif text-[18px] font-medium tracking-tight">{title}</h2>
        {description && <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function NumberField<T extends number | null>({
  id,
  label,
  value,
  onChange,
  step = 1,
  optional = false,
}: {
  id: string
  label: string
  value: T
  onChange: (value: T) => void
  step?: number
  optional?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[12px]">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') onChange((optional ? null : 0) as T)
          else onChange(Number(raw) as T)
        }}
      />
    </div>
  )
}

function StoreRow({
  store,
  checked,
  fee,
  onToggle,
  onFee,
}: {
  store: MealStore
  checked: boolean
  fee: number | undefined
  onToggle: (on: boolean) => void
  onFee: (value: string) => void
}) {
  const id = `store-${store.id}`
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onToggle(v === true)} className="h-5 w-5" />
      <label htmlFor={id} className="flex-1 min-w-0 cursor-pointer">
        <span className="block text-[14px] font-medium truncate">{store.name}</span>
        <span className="block text-[11px] text-muted-foreground truncate">
          {[store.chain, store.location, store.external_id ? `id ${store.external_id}` : null].filter(Boolean).join(' · ')}
        </span>
      </label>
      {checked && (
        <div className="w-24 shrink-0">
          <Input
            aria-label={`Onlineavgift för ${store.name}`}
            inputMode="decimal"
            placeholder="Avgift kr"
            defaultValue={fee ?? ''}
            onChange={(e) => onFee(e.target.value)}
            className="h-9 text-[13px]"
          />
        </div>
      )}
    </li>
  )
}

function AddStore({ onAdded }: { onAdded: (store: MealStore) => void }) {
  const add = useAddMealStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [chain, setChain] = useState('ICA')
  const [location, setLocation] = useState('')
  const [externalId, setExternalId] = useState('')
  const [url, setUrl] = useState('')

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus />
        Lägg till butik
      </Button>
    )
  }

  function submit() {
    if (!name.trim()) return
    add.mutate(
      {
        name: name.trim(),
        chain,
        location: location.trim() || null,
        external_id: externalId.trim() || null,
        offers_source: OFFERS_SOURCE_BY_CHAIN[chain] ?? 'manual',
        offers_url: url.trim() || null,
      },
      {
        onSuccess: (store) => {
          onAdded(store)
          setOpen(false)
          setName('')
          setLocation('')
          setExternalId('')
          setUrl('')
        },
      }
    )
  }

  return (
    <div className="rounded-2xl border border-border p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="store-name" className="text-[12px]">Namn</Label>
          <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Willys Rissne" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="store-chain" className="text-[12px]">Kedja</Label>
          <select
            id="store-chain"
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="h-11 w-full rounded-full border border-input bg-transparent px-3 text-sm"
          >
            {CHAINS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="store-location" className="text-[12px]">Ort</Label>
          <Input id="store-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="store-ext" className="text-[12px]">Butiks-id (valfritt)</Label>
          <Input id="store-ext" value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="T.ex. 2187" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="store-url" className="text-[12px]">Erbjudandesida (valfritt)</Label>
          <Input id="store-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Avbryt
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={!name.trim() || add.isPending}>
          Lägg till
        </Button>
      </div>
    </div>
  )
}
