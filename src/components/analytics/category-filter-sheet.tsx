'use client'

import { useMemo, useState } from 'react'
import { Search, Check } from 'lucide-react'
import { BottomSheet } from '@/components/shared/bottom-sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export interface CategoryOption {
  id: string
  name: string
  costType: string | null
  isInvoice: boolean
}

const GROUPS: Array<{ key: string; label: string }> = [
  { key: 'Variable', label: 'Rörliga' },
  { key: 'Fixed', label: 'Fasta' },
  { key: 'Savings', label: 'Sparande' },
  { key: 'other', label: 'Övrigt' },
]

interface CategoryFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: CategoryOption[]
  selected: Set<string>
  onApply: (selected: Set<string>) => void
}

export function CategoryFilterSheet({ open, onOpenChange, options, selected, onApply }: CategoryFilterSheetProps) {
  const [draft, setDraft] = useState<Set<string>>(selected)
  const [query, setQuery] = useState('')
  const [wasOpen, setWasOpen] = useState(open)

  // Re-seed the draft from the applied filter each time the sheet opens.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(new Set(selected))
      setQuery('')
    }
  }

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = options.filter((o) => !q || o.name.toLowerCase().includes(q))
    return GROUPS.map((g) => ({
      ...g,
      items: visible
        .filter((o) => (g.key === 'other' ? !['Variable', 'Fixed', 'Savings'].includes(o.costType || '') : o.costType === g.key))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv')),
    })).filter((g) => g.items.length > 0)
  }, [options, query])

  const toggle = (id: string) =>
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleGroup = (ids: string[]) =>
    setDraft((prev) => {
      const next = new Set(prev)
      const allOn = ids.every((id) => next.has(id))
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)))
      return next
    })

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrera kategorier"
      subtitle={draft.size === 0 ? 'Alla kategorier' : `${draft.size} valda`}
      toolbar={
        <div className="flex items-center gap-2.5 bg-secondary/60 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök kategori…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
      }
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setDraft(new Set())} disabled={draft.size === 0}>
            Rensa
          </Button>
          <Button
            className="flex-[2]"
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
          >
            {draft.size === 0 ? 'Visa alla' : `Visa ${draft.size} ${draft.size === 1 ? 'kategori' : 'kategorier'}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {grouped.map((g) => {
          const ids = g.items.map((i) => i.id)
          const allOn = ids.every((id) => draft.has(id))
          return (
            <div key={g.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="label-caps text-muted-foreground">{g.label}</span>
                <button type="button" onClick={() => toggleGroup(ids)} className="text-[11px] font-medium text-hb-cognac-deep">
                  {allOn ? 'Avmarkera' : 'Välj alla'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((o) => {
                  const on = draft.has(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(o.id)}
                      aria-pressed={on}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition-colors',
                        on
                          ? 'bg-hb-nav text-hb-nav-foreground border-hb-nav'
                          : 'bg-card border-border text-foreground hover:bg-secondary'
                      )}
                    >
                      {on && <Check className="w-3.5 h-3.5" />}
                      {o.name}
                      {o.isInvoice && <span className={cn('text-[10px]', on ? 'opacity-70' : 'text-muted-foreground')}>(faktura)</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {grouped.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Ingen kategori matchar.</p>}
      </div>
    </BottomSheet>
  )
}
