'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { SpendHero } from '@/components/dashboard/spend-hero'
import { Amount } from '@/components/shared/amount'
import { FlatMonoDirection } from './flat-mono-direction'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import {
  assignmentLabel,
  mockCategories,
  mockExpenses,
  mockPeriod,
  mockSpend,
} from './sandbox-data'

export const directions = [
  {
    id: 'nuvarande',
    name: 'Nuvarande',
    note: 'Den riktiga översikten efter omgörningen: mörk platta, platta block, siffror i monospace. Heron är samma komponent som i appen.',
  },
  {
    id: 'redaktionell',
    name: 'Redaktionell',
    note: '/distill + /clarify. Inga kort. Stor serif-siffra, en mening som översätter siffran till ett beslut, takten som två linjer.',
  },
  {
    id: 'kassabok',
    name: 'Kassabok',
    note: 'Tät och ärlig. Monospace-siffror, hårlinjer, punktlinjer mellan text och belopp. Mer information per skärm utan att det känns trångt.',
  },
  {
    id: 'kontrast',
    name: 'Kontrast',
    note: 'En mörk platta, en enda accentfärg. Siffran tar halva skärmen. Takten visas som en mätare där “idag” är markerad.',
  },
  {
    id: 'platt',
    name: 'Platt mono',
    note: 'Ditt val från 06: 24 px hörn, cognac, monospace-siffror, platta ytor, kompakt. Här på en hel översikt, med reglage för att spåna vidare.',
  },
] as const

export type DirectionId = (typeof directions)[number]['id']

export function isDirectionId(value: string | null): value is DirectionId {
  return directions.some((d) => d.id === value)
}

const remaining = mockSpend.budget - mockSpend.spent
const perDay = Math.round(remaining / mockPeriod.daysLeft)
const spentRatio = mockSpend.spent / mockSpend.budget
const timeRatio = mockPeriod.daysElapsed / mockPeriod.daysTotal
const expectedByNow = Math.round(mockSpend.budget * timeRatio)
const aheadOfPace = mockSpend.spent - expectedByNow

const pct = (n: number) => `${Math.round(n * 100)}%`

/* ------------------------------------------------------------------ */
/* Current                                                             */
/* ------------------------------------------------------------------ */

function CurrentDirection() {
  return (
    <div className="space-y-5">
      <SpendHero
        spent={mockSpend.spent}
        budget={mockSpend.budget}
        income={mockSpend.income}
        cashOut={mockSpend.cashOut}
        hasBudget
        forecast={mockSpend.forecast}
        savingsRoom={mockSpend.savingsRoom}
        nextInvoice={mockSpend.nextInvoice}
        daysLeft={mockPeriod.daysLeft}
        periodProgress={mockPeriod.daysElapsed / mockPeriod.daysTotal}
      />
      <div>
        <h3 className="px-1 pb-2 text-[13px] font-medium">Senaste</h3>
        <ul className="overflow-hidden rounded-[24px] bg-surface">
          {mockExpenses.slice(0, 4).map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between border-b border-surface-line px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium tracking-tight">{e.description}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {e.category} · {e.date}
                </div>
              </div>
              <Amount value={e.amount} className="ml-3 shrink-0 text-[14px]" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Editorial                                                           */
/* ------------------------------------------------------------------ */

function EditorialDirection() {
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">Kvar att spendera · {mockPeriod.label}</p>
      <p className="mt-1 font-serif-hero text-[64px] leading-[0.95] tabular-nums md:text-[80px]">
        {formatCurrency(remaining)}
      </p>
      <p className="mt-4 max-w-[34ch] text-[17px] leading-snug text-balance">
        Det räcker till <strong className="font-semibold">≈ {formatCurrency(perDay)} om dagen</strong> de
        sista {mockPeriod.daysLeft} dagarna.
      </p>

      {/* Pace: money vs time as two aligned lines */}
      <div className="mt-6 space-y-2.5" role="group" aria-label="Takt">
        {[
          { label: 'Pengar', value: spentRatio, cls: 'bg-foreground' },
          { label: 'Tid', value: timeRatio, cls: 'bg-foreground/30' },
        ].map((row) => (
          <div key={row.label} className="grid grid-cols-[3.5rem_1fr_2.75rem] items-center gap-3">
            <span className="text-[12px] text-muted-foreground">{row.label}</span>
            <div className="h-[3px] bg-foreground/10">
              <div className={cn('h-full', row.cls)} style={{ width: pct(row.value) }} />
            </div>
            <span className="text-right text-[12px] tabular-nums">{pct(row.value)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground text-pretty">
        {formatCurrency(aheadOfPace)} före takten. Prognosen landar på ~
        {formatCurrency(mockSpend.forecast.spend)}, under budget.
      </p>

      <h3 className="mt-10 font-serif text-[22px]">Senaste</h3>
      <ul className="mt-2">
        {mockExpenses.slice(0, 4).map((e) => (
          <li key={e.id} className="flex items-baseline gap-3 border-b border-border py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px]">{e.description}</p>
              <p className="text-[12px] text-muted-foreground">
                {e.date} · {e.category}
                {e.assignment !== 'personal' && ` · ${assignmentLabel[e.assignment]}`}
              </p>
            </div>
            <span className="shrink-0 text-[15px] tabular-nums">{formatCurrency(e.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

function LedgerRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className={cn('shrink-0', strong ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-foreground/25" aria-hidden="true" />
      <span className={cn('shrink-0 tabular-nums', strong && 'font-semibold')}>{value}</span>
    </div>
  )
}

function LedgerDirection() {
  return (
    <div className="font-mono text-[13px]">
      <div className="flex items-baseline justify-between border-b-2 border-foreground pb-2">
        <span className="font-semibold uppercase tracking-wider">Period</span>
        <span className="tabular-nums text-muted-foreground">
          {mockPeriod.label} · dag {mockPeriod.daysElapsed}/{mockPeriod.daysTotal}
        </span>
      </div>

      <div className="py-3">
        <LedgerRow label="Budget" value={formatCurrency(mockSpend.budget)} />
        <LedgerRow label="Spenderat" value={`− ${formatCurrency(mockSpend.spent)}`} />
        <div className="my-1 border-t border-foreground/40" />
        <LedgerRow label="Kvar" value={formatCurrency(remaining)} strong />
        <LedgerRow label="Per dag (11 d)" value={formatCurrency(perDay)} />
      </div>

      <div className="grid grid-cols-2 border-y border-border">
        {[
          ['Prognos', `~${formatCurrency(mockSpend.forecast.spend)}`],
          ['Kassaflöde', `+${formatCurrency(mockSpend.income - mockSpend.cashOut)}`],
          ['Spara', `~${formatCurrency(mockSpend.savingsRoom.room)}`],
          ['Kortfaktura', `~${formatCurrency(mockSpend.nextInvoice.value)}`],
        ].map(([label, value], i) => (
          <div key={label} className={cn('px-0 py-2.5', i % 2 === 1 && 'border-l border-border pl-3', i < 2 && 'border-b border-border')}>
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-0.5 tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-baseline justify-between border-b-2 border-foreground pb-2">
        <span className="font-semibold uppercase tracking-wider">Kategorier</span>
        <span className="text-muted-foreground">av budget</span>
      </div>
      <div className="py-2">
        {mockCategories.map((c) => {
          const over = c.spent > c.budget
          return (
            <div key={c.name} className="flex items-baseline gap-2 py-1">
              <span className="w-20 shrink-0">{c.name}</span>
              <span className="flex-1 overflow-hidden whitespace-nowrap text-foreground/25" aria-hidden="true">
                {'·'.repeat(40)}
              </span>
              <span className={cn('shrink-0 tabular-nums', over && 'text-destructive')}>
                {formatCurrency(c.spent)}
              </span>
              <span className={cn('w-11 shrink-0 text-right tabular-nums text-muted-foreground', over && 'text-destructive')}>
                {pct(c.spent / c.budget)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-baseline justify-between border-b-2 border-foreground pb-2">
        <span className="font-semibold uppercase tracking-wider">Senaste</span>
      </div>
      <div className="py-2">
        {mockExpenses.map((e) => (
          <div key={e.id} className="flex items-baseline gap-3 py-1">
            <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{e.date}</span>
            <span className="min-w-0 flex-1 truncate">{e.description}</span>
            <span className="shrink-0 tabular-nums">{formatCurrency(e.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Contrast                                                            */
/* ------------------------------------------------------------------ */

function ContrastDirection() {
  return (
    <div className="space-y-6">
      {/* Hard-coded light text: CSS-variable opacity renders unreliably in Capacitor */}
      <div className="rounded-[22px] bg-[#2a2420] px-5 pb-6 pt-7 text-[#f4ede3] md:px-8">
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="text-[#f4ede3]/60">Kvar att spendera</span>
          <span className="tabular-nums text-[#f4ede3]/60">{mockPeriod.daysLeft} dagar till lön</span>
        </div>
        <p className="mt-3 font-sans text-[72px] font-semibold leading-[0.9] tracking-[-0.045em] tabular-nums md:text-[96px]">
          {formatCurrency(remaining).replace(/\s?kr$/, '')}
          <span className="ml-2 align-top text-[22px] font-medium tracking-normal text-[#d4a574]">kr</span>
        </p>
        <p className="mt-3 text-[15px] text-[#f4ede3]/80">
          ≈ <span className="tabular-nums text-[#d4a574]">{formatCurrency(perDay)}</span> om dagen
        </p>

        {/* Gauge: spent fill, "today" tick */}
        <div className="relative mt-8 h-10" role="img" aria-label={`${pct(spentRatio)} av budgeten spenderad, ${pct(timeRatio)} av perioden har gått`}>
          <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-[#f4ede3]/12" />
          <div className="absolute left-0 top-4 h-2 rounded-full bg-[#d4a574]" style={{ width: pct(spentRatio) }} />
          <div className="absolute top-1.5 h-7 w-px bg-[#f4ede3]" style={{ left: pct(timeRatio) }} />
          <span
            className="absolute -top-2 -translate-x-1/2 text-[10px] tabular-nums text-[#f4ede3]/70"
            style={{ left: pct(timeRatio) }}
          >
            idag
          </span>
          <div className="absolute inset-x-0 top-8 flex justify-between text-[10px] tabular-nums text-[#f4ede3]/50">
            <span>0</span>
            <span>{formatCurrency(mockSpend.budget)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-border">
        {[
          ['Prognos', formatCurrency(mockSpend.forecast.spend)],
          ['Spara', formatCurrency(mockSpend.savingsRoom.room)],
          ['Kort', formatCurrency(mockSpend.nextInvoice.value)],
        ].map(([label, value]) => (
          <div key={label} className="bg-background px-3 py-3">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-1 text-[15px] font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <ul>
        {mockExpenses.slice(0, 4).map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-hb-cognac" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{e.description}</span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatCurrency(e.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const views: Record<DirectionId, () => React.ReactElement> = {
  nuvarande: CurrentDirection,
  redaktionell: EditorialDirection,
  kassabok: LedgerDirection,
  kontrast: ContrastDirection,
  platt: FlatMonoDirection,
}

interface HeroDirectionsProps {
  value: DirectionId
  onChange: (id: DirectionId) => void
}

export function HeroDirections({ value, onChange }: HeroDirectionsProps) {
  const active = directions.find((d) => d.id === value) ?? directions[0]
  const View = views[active.id]

  return (
    <div>
      <div role="radiogroup" aria-label="Layoutriktning" className="flex flex-wrap gap-1.5">
        {directions.map((d, i) => {
          const selected = d.id === value
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(d.id)}
              className={cn(
                'relative rounded-full border px-3.5 py-1.5 text-[13px] transition-colors duration-150',
                selected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
              )}
            >
              <span className="mr-1.5 font-mono text-[10px] tabular-nums opacity-60">{String.fromCharCode(65 + i)}</span>
              {d.name}
            </button>
          )
        })}
      </div>
      <p className="mt-3 min-h-[3lh] text-[13px] leading-relaxed text-muted-foreground text-pretty" aria-live="polite">
        {active.note}
      </p>

      <div className="mt-4 rounded-[28px] border border-dashed border-foreground/20 p-4 md:p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <View />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
