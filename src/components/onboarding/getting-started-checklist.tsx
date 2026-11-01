'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, ChevronRight, X } from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { useIncomes } from '@/hooks/use-incomes'
import { useBudgets } from '@/hooks/use-budgets'
import { useRecentExpenses } from '@/hooks/use-expenses'
import { useIntros, useMarkIntroSeen } from '@/hooks/use-modules'
import { cn } from '@/lib/utils/cn'

const CHECKLIST_KEY = 'checklist'

function subscribeNoop() {
  return () => {}
}

/** True when the app runs from the home screen (PWA) instead of a browser tab. */
function useIsInstalled() {
  return useSyncExternalStore(
    subscribeNoop,
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => true
  )
}

interface Item {
  id: string
  title: string
  body: string
  href?: string
  done: boolean
}

/**
 * "Kom igång" on the overview for new users. Each item ticks itself off from
 * real data, and the card disappears when everything is done or dismissed.
 */
export function GettingStartedChecklist() {
  const { data: user } = useUser()
  const { ready, hasSeen } = useIntros()
  const markSeen = useMarkIntroSeen()
  const { data: incomes, isLoading: incomesLoading } = useIncomes()
  const { data: budgets, isLoading: budgetsLoading } = useBudgets()
  const { data: expenses, isLoading: expensesLoading } = useRecentExpenses(1)
  const installed = useIsInstalled()
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  if (!user || !ready || hasSeen(CHECKLIST_KEY)) return null
  if (incomesLoading || budgetsLoading || expensesLoading) return null

  const items: Item[] = [
    {
      id: 'income',
      title: 'Lägg in din lön',
      body: 'Så vet budgeten hur mycket du har att fördela',
      href: '/settings/profile',
      done: (incomes ?? []).some((i) => i.user_id === user.id),
    },
    {
      id: 'expense',
      title: 'Lägg in eller importera utgifter',
      body: 'Skriv in ett köp eller läs in en fil från banken',
      href: '/import',
      done: (expenses ?? []).length > 0,
    },
    {
      id: 'budget',
      title: 'Skapa din första budget',
      body: 'Bestäm vad varje kategori får kosta den här perioden',
      href: '/budget/new',
      done: (budgets ?? []).length > 0,
    },
    {
      id: 'install',
      title: 'Lägg Homebase på hemskärmen',
      body: 'Öppnas som en app och kan skicka påminnelser',
      done: installed,
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  if (doneCount === items.length) return null

  const dismiss = () => markSeen.mutate({ userId: user.id, key: CHECKLIST_KEY })

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} aria-labelledby="getting-started-title">
      <div className="flex items-baseline justify-between pb-2.5">
        <h2 id="getting-started-title" className="font-serif text-[20px] font-medium tracking-tight">
          Kom igång
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">
            {doneCount} av {items.length} klart
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Dölj Kom igång"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden">
        {items.map((item) => {
          const content = (
            <>
              <span
                className={cn(
                  'w-6 h-6 rounded-full border grid place-items-center shrink-0',
                  item.done ? 'bg-hb-green border-hb-green text-white' : 'border-muted-foreground/40'
                )}
                aria-hidden="true"
              >
                {item.done && <Check className="w-3.5 h-3.5" />}
              </span>
              <span className="flex-1 min-w-0 text-left">
                <span className={cn('block text-[14px] font-medium', item.done && 'line-through text-muted-foreground')}>
                  {item.title}
                </span>
                {!item.done && <span className="block text-[12px] text-muted-foreground">{item.body}</span>}
              </span>
              {!item.done && <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />}
              <span className="sr-only">{item.done ? '(klart)' : '(inte klart)'}</span>
            </>
          )
          const rowClass = 'w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors'

          if (item.id === 'install') {
            return (
              <div key={item.id}>
                <button
                  type="button"
                  className={rowClass}
                  onClick={() => setShowInstallHelp((v) => !v)}
                  aria-expanded={showInstallHelp}
                  disabled={item.done}
                >
                  {content}
                </button>
                {showInstallHelp && !item.done && (
                  <div className="px-4 pb-3 pl-13 text-[13px] text-muted-foreground space-y-1.5">
                    <p>
                      <strong className="text-foreground">iPhone:</strong> öppna Homebase i Safari, tryck på dela-ikonen och
                      välj &quot;Lägg till på hemskärmen&quot;.
                    </p>
                    <p>
                      <strong className="text-foreground">Android:</strong> öppna menyn (tre prickar) i Chrome och välj
                      &quot;Installera app&quot;.
                    </p>
                  </div>
                )}
              </div>
            )
          }

          return item.done || !item.href ? (
            <div key={item.id} className={rowClass}>
              {content}
            </div>
          ) : (
            <Link key={item.id} href={item.href} className={rowClass}>
              {content}
            </Link>
          )
        })}
      </div>
    </motion.section>
  )
}
