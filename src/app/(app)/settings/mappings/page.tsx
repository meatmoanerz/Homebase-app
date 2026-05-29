'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useCategoryMappings, useUpdateMapping, useDeleteMapping, useCreateMapping, type CategoryMapping } from '@/hooks/use-category-mappings'
import { useCategories } from '@/hooks/use-categories'
import { useAssignmentOptions } from '@/hooks/use-assignment-options'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Search, Sparkles, Trash2, Plus, X, Check, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

export default function MappingsSettingsPage() {
  const { data: mappings = [], isLoading } = useCategoryMappings()
  const { data: categories = [] } = useCategories()
  const updateMapping = useUpdateMapping()
  const deleteMapping = useDeleteMapping()
  const createMapping = useCreateMapping()
  const assignmentOptions = useAssignmentOptions()

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return mappings
      .filter((m) => {
        if (!q) return true
        const catName = m.category_id ? categoryById.get(m.category_id)?.name?.toLowerCase() ?? '' : ''
        return m.pattern.toLowerCase().includes(q) || catName.includes(q)
      })
      .sort((a, b) => b.priority - a.priority || b.hit_count - a.hit_count)
  }, [mappings, search, categoryById])

  async function handleDelete(id: string) {
    try {
      await deleteMapping.mutateAsync(id)
      toast.success('Regel borttagen')
      setConfirmDeleteId(null)
    } catch {
      toast.error('Kunde inte ta bort regeln')
    }
  }

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="w-9 h-9 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-[24px] md:text-[32px] font-medium tracking-tight">
            Kategoriregler
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Styr hur transaktioner kategoriseras automatiskt
          </p>
        </div>
      </div>

      {/* Explainer */}
      <div className="bg-card border border-border rounded-2xl p-4 text-xs text-muted-foreground leading-relaxed flex gap-2.5">
        <Sparkles className="w-4 h-4 text-hb-cognac flex-shrink-0 mt-0.5" />
        <p>
          När du importerar bankfiler matchas varje transaktion mot dessa regler.
          Reglerna söker efter ett textmönster i transaktionstexten — längsta
          träffen vinner, så &quot;ICA MAXI&quot; slår &quot;ICA&quot;. Nya regler skapas automatiskt
          när du kategoriserar okända transaktioner.
        </p>
      </div>

      {/* Search + add */}
      <div className="flex gap-2">
        <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3.5 py-2.5 flex-1">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Sök mönster eller kategori…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="w-11 rounded-xl bg-hb-nav text-hb-nav-foreground grid place-items-center hover:opacity-90 transition-opacity flex-shrink-0"
          aria-label="Lägg till regel"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <AddMappingForm
              categories={categories}
              assignmentOptions={assignmentOptions}
              onCancel={() => setShowAddForm(false)}
              onSave={async (data) => {
                try {
                  await createMapping.mutateAsync(data)
                  toast.success('Regel skapad')
                  setShowAddForm(false)
                } catch {
                  toast.error('Kunde inte skapa regeln')
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Count */}
      {!isLoading && (
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-semibold px-1">
          {filtered.length} {filtered.length === 1 ? 'regel' : 'regler'}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground px-1">Laddar…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
          {search ? `Inga regler matchar "${search}"` : 'Inga regler ännu'}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {filtered.map((m) => (
            <MappingRow
              key={m.id}
              mapping={m}
              categories={categories}
              categoryById={categoryById}
              assignmentOptions={assignmentOptions}
              isEditing={editingId === m.id}
              confirmDelete={confirmDeleteId === m.id}
              onEdit={() => setEditingId(m.id)}
              onCancelEdit={() => setEditingId(null)}
              onRequestDelete={() => setConfirmDeleteId(m.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={() => handleDelete(m.id)}
              onSave={async (updates) => {
                try {
                  await updateMapping.mutateAsync({ id: m.id, ...updates })
                  toast.success('Regel uppdaterad')
                  setEditingId(null)
                } catch {
                  toast.error('Kunde inte spara ändringen')
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MappingRow({
  mapping,
  categories,
  categoryById,
  assignmentOptions,
  isEditing,
  confirmDelete,
  onEdit,
  onCancelEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onSave,
}: {
  mapping: CategoryMapping
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categoryById: Map<string, any>
  assignmentOptions: { value: string; label: string }[]
  isEditing: boolean
  confirmDelete: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onSave: (updates: Partial<CategoryMapping>) => void
}) {
  const [pattern, setPattern] = useState(mapping.pattern)
  const [categoryId, setCategoryId] = useState(mapping.category_id ?? '')
  const [costAssignment, setCostAssignment] = useState(mapping.cost_assignment ?? '')

  const cat = mapping.category_id ? categoryById.get(mapping.category_id) : null

  if (isEditing) {
    return (
      <div className="px-4 py-3 border-b border-border last:border-b-0 bg-secondary/30 space-y-2.5">
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-hb-cognac"
          placeholder="Textmönster (t.ex. ICA MAXI)"
        />
        <div className="flex gap-2 flex-wrap">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="text-[12px] bg-card border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-hb-cognac flex-1"
          >
            <option value="">— ingen kategori —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={costAssignment}
            onChange={(e) => setCostAssignment(e.target.value)}
            className="text-[12px] bg-card border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-hb-cognac"
          >
            <option value="">Ingen default</option>
            {assignmentOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancelEdit}
            className="px-3 py-1.5 rounded-full border border-border text-xs font-medium hover:bg-secondary transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={() =>
              onSave({
                pattern: pattern.trim(),
                category_id: categoryId || null,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                cost_assignment: (costAssignment || null) as any,
              })
            }
            className="px-3 py-1.5 rounded-full bg-hb-nav text-hb-nav-foreground text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Spara
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'px-4 py-3 border-b border-border last:border-b-0 transition-colors',
        confirmDelete ? 'bg-destructive/5' : 'hover:bg-secondary/40'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <button onClick={onEdit} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm tracking-tight truncate">{mapping.pattern}</span>
            {mapping.bank && (
              <span className="text-[9px] uppercase tracking-wide bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full flex-shrink-0">
                {mapping.bank}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground">
              {cat?.name ?? 'Ingen kategori'}
            </span>
            {mapping.cost_assignment && (
              <span className="text-[10px] text-muted-foreground">· {assignmentLabel(mapping.cost_assignment)}</span>
            )}
            {mapping.hit_count > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                · <TrendingUp className="w-2.5 h-2.5" /> {mapping.hit_count}
              </span>
            )}
          </div>
        </button>

        {confirmDelete ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onConfirmDelete}
              className="text-[11px] font-medium text-destructive bg-destructive/10 rounded-full px-2.5 py-1 hover:bg-destructive/20 transition-colors"
            >
              Ta bort
            </button>
            <button
              onClick={onCancelDelete}
              className="w-7 h-7 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onRequestDelete}
            className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
            aria-label="Ta bort regel"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function AddMappingForm({
  categories,
  assignmentOptions,
  onCancel,
  onSave,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[]
  assignmentOptions: { value: string; label: string }[]
  onCancel: () => void
  onSave: (data: {
    pattern: string
    category_id: string
    cost_assignment?: 'personal' | 'shared' | 'partner' | null
    priority?: number
  }) => void
}) {
  const [pattern, setPattern] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [costAssignment, setCostAssignment] = useState('')

  const valid = pattern.trim().length > 0 && categoryId

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-2.5">
      <input
        type="text"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-hb-cognac"
        placeholder="Textmönster (t.ex. SPOTIFY)"
        autoFocus
      />
      <div className="flex gap-2 flex-wrap">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="text-[12px] bg-secondary border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-hb-cognac flex-1"
        >
          <option value="">Välj kategori…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={costAssignment}
          onChange={(e) => setCostAssignment(e.target.value)}
          className="text-[12px] bg-secondary border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-hb-cognac"
        >
          <option value="">Ingen default</option>
          {assignmentOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-full border border-border text-xs font-medium hover:bg-secondary transition-colors"
        >
          Avbryt
        </button>
        <button
          disabled={!valid}
          onClick={() =>
            onSave({
              pattern: pattern.trim(),
              category_id: categoryId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cost_assignment: (costAssignment || null) as any,
              priority: 50,
            })
          }
          className="px-3 py-1.5 rounded-full bg-hb-nav text-hb-nav-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 inline-flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" />
          Skapa regel
        </button>
      </div>
    </div>
  )
}

function assignmentLabel(a: string): string {
  if (a === 'personal') return 'Personlig'
  if (a === 'partner') return 'Partner'
  if (a === 'shared') return 'Delad'
  return a
}
