'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { Amount, AnimatedAmount } from '@/components/shared/amount'
import { cn } from '@/lib/utils/cn'

interface SpendHeroProps {
  /** Consumption this period: every purchase once, credit-card invoice line excluded */
  spent: number
  /** Consumption budget this period, Kreditkort row excluded (0 if none set) */
  budget: number
  /** Income that landed on the account this period */
  income: number
  /** Direct withdrawals (excl. credit-card purchases) */
  cashOut: number
  hasBudget: boolean
  /** Projected consumption for the running period (null when not the current period). */
  forecast?: { spend: number; low: number; high: number } | null
  /** Income minus projected costs and amortisation, and the voluntary savings planned. */
  savingsRoom?: { room: number; planned: number } | null
  /** Credit-card invoice drawn next period: total and what is already on the card. */
  nextInvoice?: { value: number; registered: number } | null
  /** Days left until next salary (running period only). */
  daysLeft?: number | null
  /** Share of the running period that has passed, 0–1 (running period only). */
  periodProgress?: number | null
  /** e.g. "Tims andel" when the perspective is a single person. */
  scopeLabel?: string | null
}

// Solid theme tokens, no opacity on variables: that renders unreliably in Capacitor
const SLAB_TEXT = 'text-foreground'
const SLAB_MUTED = 'text-muted-foreground'
const SLAB_ACCENT = 'var(--chart-spend)'
const SLAB_OVER = 'var(--destructive)'

/**
 * Main hero on the dashboard: one slab (flat in light, dark in dark theme), flat tiles below.
 *
 * SLAB: remaining to spend (or spent when there is no budget), what that
 * means per day until salary, and a pace bar where the fill is the money
 * spent and the tick is today. Every purchase counts once when it is made,
 * card purchases included, so the number moves the moment you buy something.
 *
 * TILES: cash flow so far (income minus what leaves the account), the room
 * to save against the plan, and the card invoice that follows next period.
 */
export function SpendHero({
  spent,
  budget,
  income,
  cashOut,
  hasBudget,
  forecast,
  savingsRoom,
  nextInvoice,
  daysLeft,
  periodProgress,
  scopeLabel,
}: SpendHeroProps) {
  const remaining = budget - spent
  const overBudget = hasBudget && remaining < 0
  const spentRatio = budget > 0 ? Math.min(spent / budget, 1) : 0
  const cashFlow = income - cashOut
  const perDay = hasBudget && remaining > 0 && daysLeft != null && daysLeft > 0 ? remaining / daysLeft : null

  const primaryValue = hasBudget ? remaining : spent
  const primaryLabel = hasBudget ? 'Kvar att spendera' : 'Spenderat denna period'

  // Scroll: once the slab has scrolled up under the header, a compact pill
  // keeps the number in view (the hero "collapses" into the top).
  const slabRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const el = slabRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      // The mobile header covers roughly the top 70px
      { rootMargin: '-70px 0px 0px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="space-y-1.5">
      <AnimatePresence>
        {collapsed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+70px)] z-30 mx-auto flex w-fit items-baseline gap-2 rounded-full bg-popover px-4 py-2 text-[13px] text-popover-foreground shadow-lg md:left-60 md:top-4"
            aria-hidden="true"
          >
            <span className="text-muted-foreground">{hasBudget ? 'Kvar' : 'Spenderat'}</span>
            <Amount value={primaryValue} className={cn('text-[15px] font-medium', overBudget && 'text-destructive')} />
            {perDay != null && (
              <span className="text-muted-foreground">
                · <Amount value={perDay} className="text-hb-cognac-deep" />/dag
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={slabRef} className={cn('rounded-[24px] bg-hero-slab px-5 pb-5 pt-4', SLAB_TEXT)}>
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className={SLAB_MUTED}>{primaryLabel}</span>
          <span className="flex items-center gap-2">
            {scopeLabel && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{scopeLabel}</span>
            )}
            {daysLeft != null && (
              <span className={cn('tabular-nums', SLAB_MUTED)}>
                {daysLeft} {daysLeft === 1 ? 'dag' : 'dagar'} till lön
              </span>
            )}
          </span>
        </div>

        <p className="mt-2 text-[44px] font-medium leading-none md:text-[52px]">
          <AnimatedAmount value={primaryValue} revealKey="dashboard-hero" className={overBudget ? 'text-destructive' : undefined} />
        </p>

        {perDay != null && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            ≈ <Amount value={perDay} className="text-hb-cognac-deep" /> om dagen
          </p>
        )}
        {overBudget && (
          <p className="mt-2 text-[13px] text-muted-foreground">över budget den här perioden</p>
        )}

        {hasBudget && (
          <>
            <div
              className="relative mt-4 h-2"
              role="img"
              aria-label={
                periodProgress != null
                  ? `${Math.round(spentRatio * 100)} % av budgeten spenderad, ${Math.round(periodProgress * 100)} % av perioden har gått`
                  : `${Math.round(spentRatio * 100)} % av budgeten spenderad`
              }
            >
              <div className="absolute inset-0 rounded-full bg-secondary" />
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                style={{ width: `${spentRatio * 100}%`, background: overBudget ? SLAB_OVER : SLAB_ACCENT }}
              />
              {periodProgress != null && (
                <div
                  className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground"
                  style={{ left: `${Math.min(Math.max(periodProgress, 0), 1) * 100}%` }}
                />
              )}
            </div>
            <div className={cn('mt-1.5 flex justify-between gap-3 text-[11px]', SLAB_MUTED)}>
              <span>
                <Amount value={spent} /> av <Amount value={budget} />
              </span>
              {periodProgress != null && <span>streck = idag</span>}
            </div>
          </>
        )}

        {forecast && (
          <Link
            href="/analys?view=forecast"
            className="-mx-1 mt-3 flex items-center gap-2 rounded-[16px] bg-secondary px-3 py-2.5 transition-colors hover:bg-surface-line"
          >
            <span className="flex-1 text-[13px] text-muted-foreground">
              Landar på <Amount value={forecast.spend} prefix="~" className={SLAB_TEXT} />
              {hasBudget && (
                <span className={cn('ml-1', forecast.spend > budget * 1.05 ? 'text-destructive' : SLAB_MUTED)}>
                  ·{' '}
                  {forecast.spend <= budget ? (
                    <><Amount value={budget - forecast.spend} prefix="~" /> kvar</>
                  ) : (
                    <><Amount value={forecast.spend - budget} prefix="~" /> över</>
                  )}
                </span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className={cn('grid gap-1.5', savingsRoom && nextInvoice ? 'grid-cols-3' : savingsRoom || nextInvoice ? 'grid-cols-2' : 'grid-cols-1')}>
        <Tile
          label="Kassaflöde"
          value={<Amount value={cashFlow} prefix={cashFlow >= 0 ? '+' : ''} className={cashFlow < 0 ? 'text-destructive' : undefined} />}
          note={<>ut <Amount value={cashOut} /></>}
        />
        {savingsRoom && (
          <Tile
            label="Spara"
            value={
              <Amount
                value={savingsRoom.room}
                prefix="~"
                className={savingsRoom.room < savingsRoom.planned ? 'text-destructive' : undefined}
              />
            }
            note={savingsRoom.planned >= 1 ? <>plan <Amount value={savingsRoom.planned} /></> : null}
          />
        )}
        {nextInvoice && (
          <Tile
            label="Kortfaktura"
            value={<Amount value={nextInvoice.value} prefix="~" />}
            note={nextInvoice.value - nextInvoice.registered >= 1 ? <>hittills <Amount value={nextInvoice.registered} /></> : null}
          />
        )}
      </div>
    </div>
  )
}

interface TileProps {
  label: string
  value: React.ReactNode
  note?: React.ReactNode
}

function Tile({ label, value, note }: TileProps) {
  return (
    <div className="min-w-0 rounded-[20px] bg-surface px-3 py-2.5">
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[14px]">{value}</div>
      {note && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{note}</div>}
    </div>
  )
}
