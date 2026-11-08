'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { Segment } from './token-playground'
import {
  assignmentLabel,
  mockCategories,
  mockExpenses,
  mockPeriod,
  mockSpend,
} from './sandbox-data'

/**
 * Direction E, built from the tokens picked in the playground:
 * radius 24px, cognac accent, mono numerals, flat surfaces, compact density.
 * The knobs below vary one thing each so the base can be refined further.
 */

const heroStyles = [
  { id: 'yta', label: 'Platt yta' },
  { id: 'bakgrund', label: 'Ingen yta' },
  { id: 'mork', label: 'Mörk platta' },
] as const

const monoScopes = [
  { id: 'siffror', label: 'Bara siffror' },
  { id: 'allt', label: 'Allt' },
] as const

const listStyles = [
  { id: 'block', label: 'I block' },
  { id: 'linjer', label: 'Linjer' },
] as const

type HeroStyle = (typeof heroStyles)[number]['id']
type MonoScope = (typeof monoScopes)[number]['id']
type ListStyle = (typeof listStyles)[number]['id']

const ACCENT = '#c08850'
const remaining = mockSpend.budget - mockSpend.spent
const perDay = Math.round(remaining / mockPeriod.daysLeft)
const pct = (n: number) => `${Math.round(n * 100)}%`
const spentRatio = mockSpend.spent / mockSpend.budget
const timeRatio = mockPeriod.daysElapsed / mockPeriod.daysTotal

/** The flat surface: a tint of the background, no border, no shadow. */
const flat = 'rounded-[24px] bg-foreground/[0.045] dark:bg-foreground/[0.06]'
const num = 'font-mono tabular-nums tracking-[-0.04em]'

/**
 * Amount with the number in mono and "kr" small, muted and in sans. In a
 * monospace face the unit is as wide as a digit, so at full size it competes
 * with the number itself.
 */
function Kr({ value, prefix = '', className }: { value: number; prefix?: string; className?: string }) {
  const digits = formatCurrency(value).replace(/\s?kr$/, '')
  return (
    <span className={cn(num, className)}>
      {prefix}
      {digits}
      <span className="ml-[0.2em] font-sans text-[max(0.62em,11px)] font-normal tracking-normal opacity-60">kr</span>
    </span>
  )
}

function Hero({ style }: { style: HeroStyle }) {
  const dark = style === 'mork'
  return (
    <div
      className={cn(
        style === 'yta' && cn(flat, 'p-4'),
        style === 'bakgrund' && 'px-1 pt-1',
        dark && 'rounded-[24px] bg-[#2a2420] p-4 text-[#f4ede3]'
      )}
    >
      <div className={cn('flex items-baseline justify-between text-[12px]', dark ? 'text-[#f4ede3]/60' : 'text-muted-foreground')}>
        <span>Kvar att spendera</span>
        <span className="tabular-nums">{mockPeriod.daysLeft} d till lön</span>
      </div>
      <p className="mt-1.5 text-[44px] font-medium leading-none"><Kr value={remaining} /></p>
      <p className={cn('mt-1.5 text-[13px]', dark ? 'text-[#f4ede3]/75' : 'text-muted-foreground')}>
        ≈ <Kr value={perDay} className={dark ? 'text-[#d4a574]' : 'text-foreground'} /> om dagen
      </p>

      <div
        className="relative mt-4 h-2"
        role="img"
        aria-label={`${pct(spentRatio)} av budgeten spenderad, ${pct(timeRatio)} av perioden har gått`}
      >
        <div className={cn('absolute inset-0 rounded-full', dark ? 'bg-[#f4ede3]/15' : 'bg-foreground/10')} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(spentRatio), background: ACCENT }} />
        <div
          className={cn('absolute -inset-y-1 w-0.5 rounded-full', dark ? 'bg-[#f4ede3]' : 'bg-foreground')}
          style={{ left: pct(timeRatio) }}
        />
      </div>
      <div className={cn('mt-1.5 flex justify-between text-[11px]', dark ? 'text-[#f4ede3]/55' : 'text-muted-foreground')}>
        <span><Kr value={mockSpend.spent} /> av <Kr value={mockSpend.budget} /></span>
        <span>streck = idag</span>
      </div>
    </div>
  )
}

function Kpis() {
  const items: [string, number][] = [
    ['Prognos', mockSpend.forecast.spend],
    ['Spara', mockSpend.savingsRoom.room],
    ['Kortfaktura', mockSpend.nextInvoice.value],
  ]
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map(([label, value]) => (
        <div key={label} className={cn(flat, 'min-w-0 px-3 py-2.5')}>
          <div className="truncate text-[11px] text-muted-foreground">{label}</div>
          <div className="mt-0.5 truncate text-[14px]"><Kr value={value} prefix="~" /></div>
        </div>
      ))}
    </div>
  )
}

function Categories() {
  return (
    <div className={cn(flat, 'px-4 py-2')}>
      {mockCategories.map((c) => {
        const ratio = c.spent / c.budget
        const over = ratio > 1
        return (
          <div key={c.name} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 py-2">
            <span className="truncate text-[14px]">{c.name}</span>
            <div className="h-1.5 rounded-full bg-foreground/10">
              <div
                className={cn('h-full rounded-full', over && 'bg-destructive')}
                style={{ width: pct(Math.min(ratio, 1)), ...(over ? {} : { background: ACCENT }) }}
              />
            </div>
            <Kr
              value={c.budget - c.spent}
              className={cn('w-[5.5rem] text-right text-[13px]', over && 'text-destructive')}
            />
          </div>
        )
      })}
      <p className="pb-1 text-right text-[11px] text-muted-foreground">kvar per kategori</p>
    </div>
  )
}

function Recent({ style }: { style: ListStyle }) {
  return (
    <div className={cn(style === 'block' && cn(flat, 'px-4 py-1'))}>
      {mockExpenses.map((e) => (
        <div
          key={e.id}
          className={cn(
            'flex items-center gap-3 py-2.5',
            style === 'linjer' ? 'border-b border-border px-1' : 'border-b border-foreground/[0.06] last:border-b-0'
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px]">{e.description}</p>
            <p className="text-[11px] text-muted-foreground">
              {e.date} · {e.category}
              {e.assignment !== 'personal' && ` · ${assignmentLabel[e.assignment]}`}
            </p>
          </div>
          <Kr value={e.amount} className="shrink-0 text-[14px]" />
        </div>
      ))}
    </div>
  )
}

function AddExpenseSnippet() {
  const [selected, setSelected] = useState('Mat')
  return (
    <div className={cn(flat, 'p-4')}>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-muted-foreground">Ny utgift</span>
        <span className="text-[11px] text-muted-foreground">idag · Delad</span>
      </div>
      <p className={cn(num, 'mt-2 text-[40px] font-medium leading-none')}>
        1&nbsp;284<span className="animate-pulse-soft" style={{ color: ACCENT }}>|</span>
        <span className="ml-1.5 font-sans text-[20px] font-normal tracking-normal text-muted-foreground">kr</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {mockCategories.map((c) => {
          const on = c.name === selected
          return (
            <button
              key={c.name}
              type="button"
              aria-pressed={on}
              onClick={() => setSelected(c.name)}
              className={cn(
                'rounded-full px-3 py-1 text-[12px] transition-colors duration-150',
                on ? 'text-white' : 'bg-foreground/[0.06] text-muted-foreground hover:text-foreground'
              )}
              style={on ? { background: ACCENT } : undefined}
            >
              {c.name}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-[24px] py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: ACCENT }}
      >
        Spara utgift
      </button>
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="px-1 pb-2 pt-4 text-[13px] font-medium">{children}</h4>
}

export function FlatMonoDirection() {
  const [hero, setHero] = useState<HeroStyle>('yta')
  const [mono, setMono] = useState<MonoScope>('siffror')
  const [list, setList] = useState<ListStyle>('block')

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-3 border-b border-dashed border-foreground/20 pb-4 sm:grid-cols-3">
        <Segment label="Hero" value={hero} options={heroStyles} onChange={setHero} />
        <Segment label="Monospace för" value={mono} options={monoScopes} onChange={setMono} />
        <Segment label="Listor" value={list} options={listStyles} onChange={setList} />
      </div>

      <div className={cn(mono === 'allt' && 'font-mono [&_p]:tracking-[-0.02em]')}>
        <div className="space-y-1.5">
          <Hero style={hero} />
          <Kpis />
        </div>
        <Heading>Kategorier</Heading>
        <Categories />
        <Heading>Senaste</Heading>
        <Recent style={list} />
        <Heading>Samma stil i Ny utgift</Heading>
        <AddExpenseSnippet />
      </div>
    </div>
  )
}
