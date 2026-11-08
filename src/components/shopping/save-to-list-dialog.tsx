'use client'

import { useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useMealPlans } from '@/hooks/use-meals'
import { useSaveDraftToList, useShoppingLists, useTargetItemKeys } from '@/hooks/use-shopping'
import { nameKey } from '@/lib/shopping/sections'
import { cn } from '@/lib/utils/cn'
import type { DraftItem, SaveTarget } from '@/types/shopping'

type Choice = `plan:${string}` | `list:${string}` | 'new'

function defaultListName(): string {
  const date = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date())
  return `Inköpslista ${date.replace('.', '')}`
}

export interface SaveResult {
  kind: 'meal_plan' | 'list'
  id: string
}

/** Pick a Veckomat list, an own list or a new one, and save the draft there. */
export function SaveToListDialog({
  open,
  onOpenChange,
  items,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: DraftItem[]
  onSaved: (result: SaveResult, info: { savedCount: number; handledIds: string[] }) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* Mounted per opening, so the choice and the new name start fresh. */}
        {open && <SaveToListForm items={items} onSaved={onSaved} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SaveToListForm({
  items,
  onSaved,
  onCancel,
}: {
  items: DraftItem[]
  onSaved: (result: SaveResult, info: { savedCount: number; handledIds: string[] }) => void
  onCancel: () => void
}) {
  const { data: plans = [], isLoading: plansLoading } = useMealPlans()
  const { data: lists = [], isLoading: listsLoading } = useShoppingLists()
  const save = useSaveDraftToList()

  const visiblePlans = useMemo(() => plans.filter((p) => p.status === 'visible'), [plans])
  const openLists = useMemo(() => lists.filter((l) => !l.archived_at), [lists])

  const [picked, setPicked] = useState<Choice | null>(null)
  const [newName, setNewName] = useState(defaultListName)
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  // Until something is picked: this week's Veckomat list, else the newest own list.
  const fallback: Choice = visiblePlans[0] ? `plan:${visiblePlans[0].id}` : openLists[0] ? `list:${openLists[0].id}` : 'new'
  const choice = picked ?? fallback

  const target: SaveTarget =
    choice === 'new'
      ? { kind: 'new', name: newName }
      : choice.startsWith('plan:')
        ? { kind: 'meal_plan', id: choice.slice(5) }
        : { kind: 'list', id: choice.slice(5) }

  const { data: existing } = useTargetItemKeys(target)
  const duplicates = useMemo(
    () => (existing ? items.filter((i) => existing.has(nameKey(i.name))) : []),
    [existing, items]
  )

  const toSave = skipDuplicates && duplicates.length > 0 ? items.filter((i) => !duplicates.includes(i)) : items
  const canSave = !save.isPending && (choice !== 'new' || newName.trim().length > 0) && (toSave.length > 0 || duplicates.length > 0)

  function submit() {
    save.mutate(
      { target, items: toSave },
      {
        onSuccess: (result) => onSaved(result, { savedCount: toSave.length, handledIds: items.map((i) => i.id) }),
      }
    )
  }

  const loading = plansLoading || listsLoading

  return (
    <>
      <DialogHeader>
        <DialogTitle>Spara till lista</DialogTitle>
        <DialogDescription>
          {items.length === 1 ? '1 vara' : `${items.length} varor`} läggs till i listan du väljer.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto -mx-1 px-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-2xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : (
          <div role="radiogroup" aria-label="Lista" className="space-y-3">
            {visiblePlans.length > 0 && (
              <Group label="Veckomat">
                {visiblePlans.map((plan) => (
                  <Option
                    key={plan.id}
                    selected={choice === `plan:${plan.id}`}
                    onSelect={() => setPicked(`plan:${plan.id}`)}
                    title={plan.name}
                    subtitle={[plan.store?.name, `${plan.items.length} varor`].filter(Boolean).join(' · ')}
                  />
                ))}
              </Group>
            )}
            {openLists.length > 0 && (
              <Group label="Egna listor">
                {openLists.map((list) => (
                  <Option
                    key={list.id}
                    selected={choice === `list:${list.id}`}
                    onSelect={() => setPicked(`list:${list.id}`)}
                    title={list.name}
                    subtitle={`${list.items.length} varor`}
                  />
                ))}
              </Group>
            )}
            <Group label="Ny">
              <Option selected={choice === 'new'} onSelect={() => setPicked('new')} title="Ny lista" icon={<Plus className="w-4 h-4" />} />
              {choice === 'new' && (
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  aria-label="Namn på listan"
                  placeholder="Namn på listan"
                  className="mt-2"
                />
              )}
            </Group>
          </div>
        )}

        {duplicates.length > 0 && (
          <label className="flex items-start gap-3 rounded-2xl bg-hb-cognac/8 border border-hb-cognac/30 px-3 py-2.5 cursor-pointer">
            <Checkbox
              checked={skipDuplicates}
              onCheckedChange={(v) => setSkipDuplicates(v === true)}
              className="h-5 w-5 mt-0.5"
            />
            <span className="text-[13px] leading-snug">
              <span className="font-medium">Hoppa över det som redan finns</span>
              <span className="block text-muted-foreground">{duplicates.map((d) => d.name).join(', ')}</span>
            </span>
          </label>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
        <Button onClick={submit} disabled={!canSave || loading}>
          {save.isPending ? 'Sparar…' : toSave.length === 0 ? 'Klart' : `Spara ${toSave.length === 1 ? '1 vara' : `${toSave.length} varor`}`}
        </Button>
      </DialogFooter>
    </>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-caps text-muted-foreground px-1 pb-1.5">{label}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Option({
  selected,
  onSelect,
  title,
  subtitle,
  icon,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
        selected ? 'border-hb-cognac bg-hb-cognac/8' : 'border-border hover:bg-secondary/50'
      )}
    >
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium truncate">{title}</span>
        {subtitle && <span className="block text-[12px] text-muted-foreground truncate">{subtitle}</span>}
      </span>
      {selected && <Check className="w-4 h-4 text-hb-cognac shrink-0" />}
    </button>
  )
}
