'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Plus, Settings2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-user'
import { useMealSettings, useMealStores, useRecentDishes, useSaveMealSettings } from '@/hooks/use-meals'
import { buildMealPrompt } from '@/lib/meals/prompt'
import type { IsoWeek } from '@/lib/meals/week'
import { formatRelativeDate } from '@/lib/utils/formatters'
import type { MealSettings } from '@/types/meals'

/**
 * The start prompt for Claude chat, built from the user's settings. The text
 * box is deliberately tiny: it is there to be copied, not read.
 */
export function MealPromptCard({
  week,
  lastPlan,
}: {
  week: IsoWeek
  /** The newest plan, whose leftovers are suggested as "on hand". */
  lastPlan: { name: string; leftovers: string[] } | null
}) {
  const { data: user } = useUser()
  const { data: settingsResult, isLoading: settingsLoading } = useMealSettings()
  const { data: stores = [] } = useMealStores()
  const { data: recentDishes = [] } = useRecentDishes()
  const [copied, setCopied] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const settings = settingsResult?.settings ?? null
  const prompt = useMemo(() => {
    if (!user || !settings) return ''
    return buildMealPrompt({
      userId: user.id,
      firstName: user.first_name ?? null,
      week,
      settings,
      stores,
      recentDishes,
      leftoversFromLastPlan: lastPlan?.leftovers ?? [],
    })
  }, [user, settings, stores, recentDishes, week, lastPlan])

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      // Older WebViews: fall back to selecting the text.
      textRef.current?.select()
      document.execCommand('copy')
    }
    setCopied(true)
    toast.success('Kopierad. Klistra in i Claude-chatten i Homebase-projektet.')
    setTimeout(() => setCopied(false), 2500)
  }

  if (settingsLoading) return null

  if (!settings) {
    return (
      <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-hb-cognac shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="font-serif text-[17px] font-medium tracking-tight">Ställ in hushållet först</h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              Hur många ni är, vilka butiker ni handlar i och era medlemskap. Sedan kan du kopiera en startprompt till
              Claude-chatten.
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/meals/settings">Öppna inställningar</Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-[17px] font-medium tracking-tight">Ny matsedel för v{week.week}</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Kopiera och klistra in i Claude-chatten i Homebase-projektet
            {settingsResult?.inherited && ' · utgår från din partners inställningar'}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon-sm" aria-label="Inställningar för veckomat">
          <Link href="/meals/settings">
            <Settings2 />
          </Link>
        </Button>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <textarea
          ref={textRef}
          readOnly
          value={prompt}
          rows={1}
          aria-label="Startprompt för veckomat"
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 h-9 resize-none overflow-hidden rounded-full bg-secondary/60 px-3 py-2 text-[11px] leading-[1.4] text-muted-foreground font-mono whitespace-nowrap"
        />
        <Button onClick={copy} size="sm" variant="cognac" disabled={!prompt}>
          {copied ? <Check /> : <Copy />}
          {copied ? 'Kopierad' : 'Kopiera'}
        </Button>
      </div>
      <OnHandField key={settings.on_hand_updated_at ?? 'none'} settings={settings} lastPlan={lastPlan} />
    </section>
  )
}

const STALE_DAYS = 7

/**
 * What is at home this week. Goes into the prompt so the plan uses it first
 * and the shopping list skips it. Saved with an explicit "Spara".
 */
function OnHandField({ settings, lastPlan }: { settings: MealSettings; lastPlan: { name: string; leftovers: string[] } | null }) {
  const save = useSaveMealSettings({ successMessage: 'Sparat' })
  const [text, setText] = useState(settings.on_hand ?? '')
  // Captured once per mount so render stays pure.
  const [now] = useState(() => Date.now())
  const saved = settings.on_hand ?? ''
  const dirty = text.trim() !== saved.trim()
  const updatedAt = settings.on_hand_updated_at
  const stale = !!saved && !!updatedAt && now - new Date(updatedAt).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000
  const suggestions = (lastPlan?.leftovers ?? []).filter((l) => !text.toLowerCase().includes(l.toLowerCase()))

  function persist(value: string) {
    const { user_id: _owner, ...rest } = settings
    void _owner
    save.mutate({ ...rest, on_hand: value.trim() || null, on_hand_updated_at: new Date().toISOString() })
  }

  return (
    <div className="mt-4 pt-3 border-t border-border space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="on-hand" className="text-[13px] font-medium">Har hemma just nu</label>
        <span className="text-[11px] text-muted-foreground">
          {saved && updatedAt ? `ändrad ${formatRelativeDate(updatedAt).toLowerCase()}` : 'används först, köps inte'}
        </span>
      </div>
      <textarea
        id="on-hand"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="T.ex. 500 g köttfärs i frysen, halv grädde, två paprikor"
        className="w-full rounded-2xl border border-input bg-transparent px-3 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {stale && !dirty && (
        <p className="text-[12px] text-hb-cognac-deep">
          Ändrades för mer än en vecka sedan. Stämmer det fortfarande?{' '}
          <button type="button" className="underline" onClick={() => { setText(''); persist('') }}>
            Töm
          </button>
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Blir över från {lastPlan?.name}:</span>
          {suggestions.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setText((t) => (t.trim() ? `${t.trim().replace(/,$/, '')}, ${l}` : l))}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[12px] hover:bg-secondary/70"
            >
              <Plus className="w-3 h-3" />
              {l}
            </button>
          ))}
        </div>
      )}
      {dirty && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setText(saved)}>
            Ångra
          </Button>
          <Button type="button" size="sm" onClick={() => persist(text)} disabled={save.isPending}>
            Spara
          </Button>
        </div>
      )}
    </div>
  )
}
