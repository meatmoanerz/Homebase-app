'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ListPlus, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SaveToListDialog } from '@/components/shopping/save-to-list-dialog'
import { SectionSelect } from '@/components/shopping/section-select'
import { cleanDraftItems, saveShoppingDraft, useShoppingDraft, useShoppingHints, type DraftRow } from '@/hooks/use-shopping'
import { nameKey, parseItemInput, suggestSection } from '@/lib/shopping/sections'
import type { DraftItem } from '@/types/shopping'

// The draft is saved on the account (shopping_list_drafts). This device keeps
// a copy too, so a row typed just before leaving the page is never lost, even
// before the account save has gone out.
const localKey = (userId: string) => `shopping-draft:${userId}`
const SAVE_DELAY_MS = 700

function readLocal(userId: string): DraftRow | null {
  try {
    const raw = localStorage.getItem(localKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { items?: unknown; updated_at?: unknown }
    return { items: cleanDraftItems(parsed.items), updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : '' }
  } catch {
    return null
  }
}

function writeLocal(userId: string, row: DraftRow) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(row))
  } catch {
    // Private mode or full storage: the account copy still holds the draft.
  }
}

function time(iso: string | undefined): number {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? 0 : t
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('sv-SE') + text.slice(1)
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Type items one by one, each with a store section, then save them to a list. */
export function ShoppingDraft({ userId }: { userId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: server, isFetched } = useShoppingDraft()
  const { data: hints } = useShoppingHints()

  const [draft, setDraft] = useState<DraftRow>(() => readLocal(userId) ?? { items: [], updated_at: '' })
  const [seenServerAt, setSeenServerAt] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [pickedSection, setPickedSection] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  // Take the account's draft when it is newer than this device's copy (edited
  // on another device). Adjusting state during render, not in an effect.
  if (server && server.updated_at !== seenServerAt) {
    setSeenServerAt(server.updated_at)
    if (time(server.updated_at) > time(draft.updated_at)) setDraft(server)
  }

  // ------------------------------------------------------------ account save

  const pending = useRef<DraftRow | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const row = pending.current
    if (!row) return
    pending.current = null
    setSyncState('saving')
    saveShoppingDraft(userId, row.items, row.updated_at)
      .then(() => {
        queryClient.setQueryData(['shopping-draft', userId], row)
        setSyncState((s) => (s === 'saving' ? 'saved' : s))
      })
      .catch(() => setSyncState('error'))
  }, [userId, queryClient])

  const scheduleSave = useCallback(
    (row: DraftRow) => {
      pending.current = row
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY_MS)
    },
    [flush]
  )

  // Send what is waiting when the page is left or the app goes to the background.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  // This device has rows the account doesn't (edited offline): send them up.
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  useEffect(() => {
    if (!isFetched) return
    const local = draftRef.current
    if (local.updated_at && time(local.updated_at) > time(server?.updated_at)) scheduleSave(local)
  }, [isFetched, server?.updated_at, scheduleSave])

  const update = useCallback(
    (change: (items: DraftItem[]) => DraftItem[]) => {
      const row = { items: change(draftRef.current.items), updated_at: new Date().toISOString() }
      draftRef.current = row
      setDraft(row)
      writeLocal(userId, row)
      scheduleSave(row)
    },
    [userId, scheduleSave]
  )

  // ------------------------------------------------------------ adding

  const parsed = parseItemInput(text)
  const autoSection = suggestSection(parsed.name, hints?.sections)
  const section = pickedSection ?? autoSection

  function add() {
    if (!parsed.name) return
    const key = nameKey(parsed.name)
    const existing = draft.items.find((i) => nameKey(i.name) === key)
    if (existing) {
      toast.info(`${existing.name} finns redan i listan`)
      return
    }
    const item: DraftItem = {
      id: newId(),
      name: capitalize(parsed.name),
      qty_text: parsed.qty_text,
      section,
      manual: pickedSection != null && pickedSection !== autoSection,
    }
    update((items) => [...items, item])
    setText('')
    setPickedSection(null)
    inputRef.current?.focus()
  }

  function clearAll() {
    const previous = draft.items
    update(() => [])
    toast('Listan är tömd', {
      action: { label: 'Ångra', onClick: () => update(() => previous) },
    })
  }

  // Newest first, so the row just typed is right under the input.
  const shown = [...draft.items].reverse()

  return (
    <section className="bg-card border border-border rounded-3xl shadow-sm p-3 md:p-5 space-y-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Lägg till vara"
          aria-label="Vara"
          list={listId}
          autoComplete="off"
          enterKeyHint="done"
          className="min-w-0 flex-1 px-3"
        />
        <SectionSelect value={section} onChange={setPickedSection} />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!parsed.name} aria-label="Lägg till">
          <Plus />
        </Button>
        <datalist id={listId}>
          {(hints?.names ?? []).map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </form>

      {/* Right under the input, so it stays in reach however long the list gets. */}
      {draft.items.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
            Töm
          </Button>
          <span className="text-[11px] text-muted-foreground flex-1" aria-live="polite">
            {syncState === 'saving' ? 'Sparar…' : syncState === 'error' ? 'Kunde inte spara på kontot, finns kvar här' : ''}
          </span>
          <Button onClick={() => setSaveOpen(true)}>
            <ListPlus />
            Spara till lista ({draft.items.length})
          </Button>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-[13px] text-muted-foreground px-1 py-2">
          Skriv en vara och tryck Enter, t.ex. Mjölk 2 l. Avdelningen fylls i automatiskt och går att ändra. Listan sparas
          på kontot tills du lägger den i en lista.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((item) => (
            <li key={item.id} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1 pl-1">
                <div className="text-[15px] font-medium truncate">{item.name}</div>
                {item.qty_text && <div className="text-[12px] text-muted-foreground">{item.qty_text}</div>}
              </div>
              <SectionSelect
                value={item.section}
                label={`Avdelning för ${item.name}`}
                onChange={(next) =>
                  update((items) => items.map((i) => (i.id === item.id ? { ...i, section: next, manual: true } : i)))
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 text-muted-foreground"
                aria-label={`Ta bort ${item.name}`}
                onClick={() => update((items) => items.filter((i) => i.id !== item.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SaveToListDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        items={draft.items}
        onSaved={(result, { savedCount, handledIds }) => {
          setSaveOpen(false)
          const handled = new Set(handledIds)
          update((items) => items.filter((i) => !handled.has(i.id)))
          const href = result.kind === 'meal_plan' ? `/meals/${result.id}` : `/shopping/${result.id}`
          toast.success(savedCount === 1 ? '1 vara sparad i listan' : `${savedCount} varor sparade i listan`, {
            action: { label: 'Öppna', onClick: () => router.push(href) },
          })
        }}
      />
    </section>
  )
}
