'use client'

import { useEffect, useRef, useState } from 'react'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { mockExpenses, mockSpend } from './sandbox-data'

const ease = [0.2, 0, 0, 1] as const

function DemoFrame({ label, title, children, action }: { label: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">{label}</p>
          <h3 className="mt-0.5 text-[15px] font-medium text-balance">{title}</h3>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reveal: the number counts to its value, rows follow                  */
/* ------------------------------------------------------------------ */

function RevealDemo() {
  const reduce = useReducedMotion()
  const value = useMotionValue(0)
  const display = useTransform(value, (v) => formatCurrency(Math.round(v)))
  const [run, setRun] = useState(0)
  const target = mockSpend.budget - mockSpend.spent

  useEffect(() => {
    if (reduce) {
      value.set(target)
      return
    }
    value.set(0)
    const controls = animate(value, target, { duration: 1.1, ease })
    return () => controls.stop()
  }, [run, reduce, target, value])

  return (
    <DemoFrame
      label="Reveal"
      title="Siffran räknar fram, raderna följer efter"
      action={
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-[12px] transition-colors hover:border-foreground/40"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Spela upp
        </button>
      }
    >
      <p className="text-[13px] text-muted-foreground">Kvar att spendera</p>
      <motion.p className="font-serif-hero text-[52px] leading-none tabular-nums" aria-live="off">
        {display}
      </motion.p>
      <ul key={run} className="mt-4">
        {mockExpenses.slice(0, 3).map((e, i) => (
          <motion.li
            key={e.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.07, duration: 0.3, ease }}
            className="flex justify-between border-b border-border py-2 text-[14px]"
          >
            <span className="truncate">{e.description}</span>
            <span className="tabular-nums">{formatCurrency(e.amount)}</span>
          </motion.li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted-foreground text-pretty">
        Använd när värdet faktiskt är nytt: första öppningen för dagen, eller direkt efter att ett köp sparats.
        Inte vid varje sidbyte.
      </p>
    </DemoFrame>
  )
}

/* ------------------------------------------------------------------ */
/* Scroll: the hero collapses into the header                          */
/* ------------------------------------------------------------------ */

function ScrollDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll({ container: ref })
  const scale = useTransform(scrollY, [0, 110], [1, 0.42])
  const heroOpacity = useTransform(scrollY, [60, 110], [1, 0])
  const barOpacity = useTransform(scrollY, [70, 120], [0, 1])
  const list = [...mockExpenses, ...mockExpenses, ...mockExpenses]

  return (
    <DemoFrame label="Scroll" title="Heron krymper in i sidhuvudet när du scrollar">
      <div
        ref={ref}
        tabIndex={0}
        aria-label="Scrolldemo"
        className="relative h-[340px] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card"
      >
        <motion.div
          style={{ opacity: barOpacity }}
          className="sticky top-0 z-10 flex items-baseline justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur"
          aria-hidden="true"
        >
          <span className="text-[13px] text-muted-foreground">Kvar</span>
          <span className="text-[15px] font-semibold tabular-nums">
            {formatCurrency(mockSpend.budget - mockSpend.spent)}
          </span>
        </motion.div>
        <div className="-mt-[41px] px-4 pb-2 pt-6">
          <motion.div style={{ scale, opacity: heroOpacity, transformOrigin: '0% 0%' }}>
            <p className="text-[13px] text-muted-foreground">Kvar att spendera</p>
            <p className="font-serif-hero text-[48px] leading-none tabular-nums">
              {formatCurrency(mockSpend.budget - mockSpend.spent)}
            </p>
          </motion.div>
        </div>
        <ul className="px-4 pb-4">
          {list.map((e, i) => (
            <li key={`${e.id}-${i}`} className="flex justify-between border-b border-border py-2.5 text-[14px]">
              <span className="truncate">{e.description}</span>
              <span className="tabular-nums">{formatCurrency(e.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground text-pretty">
        Siffran försvinner aldrig ur sikte. Bara transform och opacity animeras, så det går i 60&nbsp;fps även på en
        äldre iPhone.
      </p>
    </DemoFrame>
  )
}

/* ------------------------------------------------------------------ */
/* Transition: switching range moves, it does not blink                */
/* ------------------------------------------------------------------ */

const ranges = [
  { id: 'vecka', label: 'Vecka', total: 3_240, bars: [320, 610, 180, 940, 260, 710, 220] },
  { id: 'period', label: 'Period', total: 18_420, bars: [2_100, 3_400, 2_650, 4_100, 3_050, 1_900, 1_220] },
  { id: 'ar', label: 'År', total: 214_600, bars: [29_800, 31_200, 27_400, 33_900, 30_100, 32_600, 29_600] },
] as const

function TransitionDemo() {
  const [rangeId, setRangeId] = useState<(typeof ranges)[number]['id']>('period')
  const range = ranges.find((r) => r.id === rangeId) ?? ranges[1]
  const max = Math.max(...range.bars)

  return (
    <DemoFrame label="Transition" title="Byte av tidsspann: indikatorn glider, staplarna växer om">
      <div role="tablist" aria-label="Tidsspann" className="inline-flex rounded-full bg-secondary p-1">
        {ranges.map((r) => {
          const selected = r.id === rangeId
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setRangeId(r.id)}
              className={cn(
                'relative rounded-full px-4 py-1.5 text-[13px] transition-colors duration-150',
                selected ? 'text-background' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {selected && (
                <motion.span
                  layoutId="sandbox-range-pill"
                  className="absolute inset-0 rounded-full bg-foreground"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{r.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 h-[52px] overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={range.id}
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -28, opacity: 0 }}
            transition={{ duration: 0.25, ease }}
            className="font-serif-hero text-[44px] leading-tight tabular-nums"
          >
            {formatCurrency(range.total)}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-3 flex h-28 items-end gap-2" aria-hidden="true">
        {range.bars.map((b, i) => (
          <motion.div
            key={i}
            className="h-full flex-1 rounded-t-[3px] bg-chart-spend"
            style={{ transformOrigin: '50% 100%' }}
            initial={false}
            animate={{ scaleY: b / max }}
            transition={{ type: 'spring', stiffness: 260, damping: 30, delay: i * 0.02 }}
          />
        ))}
      </div>
    </DemoFrame>
  )
}

export function MotionLab() {
  return (
    <div className="space-y-8">
      <RevealDemo />
      <ScrollDemo />
      <TransitionDemo />
    </div>
  )
}
