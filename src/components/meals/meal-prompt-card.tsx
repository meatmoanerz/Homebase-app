'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Settings2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-user'
import { useMealSettings, useMealStores, useRecentDishes } from '@/hooks/use-meals'
import { buildMealPrompt } from '@/lib/meals/prompt'
import type { IsoWeek } from '@/lib/meals/week'

/**
 * The start prompt for Claude chat, built from the user's settings. The text
 * box is deliberately tiny: it is there to be copied, not read.
 */
export function MealPromptCard({ week }: { week: IsoWeek }) {
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
    })
  }, [user, settings, stores, recentDishes, week])

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
    </section>
  )
}
