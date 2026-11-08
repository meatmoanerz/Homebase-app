'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { mockCategories, mockExpenses } from './sandbox-data'

const radii = [
  { id: '0', label: '0', value: '0px' },
  { id: '6', label: '6', value: '6px' },
  { id: '14', label: '14', value: '14px' },
  { id: '24', label: '24', value: '24px' },
] as const

const accents = [
  { id: 'cognac', label: 'Cognac', value: '#c08850' },
  { id: 'olive', label: 'Oliv', value: '#7a8a4e' },
  { id: 'terracotta', label: 'Terrakotta', value: '#b8624c' },
  { id: 'ink', label: 'Bläck', value: '#2a2420' },
] as const

const numerals = [
  { id: 'serif', label: 'Serif', className: 'font-serif-hero' },
  { id: 'sans', label: 'Sans', className: 'font-sans font-semibold tracking-[-0.03em]' },
  { id: 'mono', label: 'Mono', className: 'font-mono tracking-[-0.04em]' },
] as const

const surfaces = [
  { id: 'card', label: 'Kort + skugga' },
  { id: 'hairline', label: 'Hårlinje' },
  { id: 'flat', label: 'Platt' },
] as const

const densities = [
  { id: 'airy', label: 'Luftig' },
  { id: 'compact', label: 'Kompakt' },
] as const

interface SegmentProps<T extends string> {
  label: string
  value: T
  options: ReadonlyArray<{ id: T; label: string; swatch?: string }>
  onChange: (id: T) => void
}

function Segment<T extends string>({ label, value, options, onChange }: SegmentProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-[12px] text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const selected = o.id === value
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] tabular-nums transition-colors duration-150',
                selected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border hover:border-foreground/40'
              )}
            >
              {o.swatch && (
                <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: o.swatch }} aria-hidden="true" />
              )}
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function TokenPlayground() {
  const [radius, setRadius] = useState<(typeof radii)[number]['id']>('14')
  const [accent, setAccent] = useState<(typeof accents)[number]['id']>('cognac')
  const [numeral, setNumeral] = useState<(typeof numerals)[number]['id']>('serif')
  const [surface, setSurface] = useState<(typeof surfaces)[number]['id']>('hairline')
  const [density, setDensity] = useState<(typeof densities)[number]['id']>('airy')
  const [notify, setNotify] = useState(true)
  const [copied, setCopied] = useState(false)

  const r = radii.find((x) => x.id === radius)!.value
  const a = accents.find((x) => x.id === accent)!.value
  const numClass = numerals.find((x) => x.id === numeral)!.className
  const compact = density === 'compact'

  const surfaceClass = {
    card: 'bg-card border border-border shadow-sm',
    hairline: 'border border-foreground/15',
    flat: 'bg-secondary/60',
  }[surface]

  const css = `:root {\n  --radius: ${r};\n  --primary: ${a};\n  --ring: ${a};\n}\n/* siffror: ${numeral} · ytor: ${surface} · täthet: ${density} */`

  async function copyTokens() {
    try {
      await navigator.clipboard.writeText(css)
      setCopied(true)
      toast.success('Tokens kopierade')
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Kunde inte kopiera. Markera texten nedan och kopiera manuellt.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Segment label="Hörnradie (px)" value={radius} options={radii} onChange={setRadius} />
        <Segment
          label="Accent"
          value={accent}
          options={accents.map((x) => ({ ...x, swatch: x.value }))}
          onChange={setAccent}
        />
        <Segment label="Siffror" value={numeral} options={numerals} onChange={setNumeral} />
        <Segment label="Ytor" value={surface} options={surfaces} onChange={setSurface} />
        <Segment label="Täthet" value={density} options={densities} onChange={setDensity} />
      </div>

      {/* Live preview */}
      <div
        className="space-y-3"
        style={{ '--sb-radius': r, '--sb-accent': a } as React.CSSProperties}
      >
        <div className={cn(surfaceClass, compact ? 'p-4' : 'p-6')} style={{ borderRadius: 'var(--sb-radius)' }}>
          <p className="text-[13px] text-muted-foreground">Kvar att spendera</p>
          <p className={cn('mt-1 leading-none tabular-nums', numClass, compact ? 'text-[40px]' : 'text-[52px]')}>
            {formatCurrency(7_580)}
          </p>
          <div className="mt-4 h-1.5 overflow-hidden bg-foreground/10" style={{ borderRadius: 'var(--sb-radius)' }}>
            <div className="h-full" style={{ width: '71%', background: 'var(--sb-accent)', borderRadius: 'var(--sb-radius)' }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--sb-accent)', borderRadius: 'var(--sb-radius)' }}
            >
              Lägg till utgift
            </button>
            <button
              type="button"
              className="border border-border px-4 py-2 text-[13px] transition-colors hover:border-foreground/40"
              style={{ borderRadius: 'var(--sb-radius)' }}
            >
              Visa period
            </button>
          </div>
        </div>

        <div className={cn(surfaceClass, 'overflow-hidden')} style={{ borderRadius: 'var(--sb-radius)' }}>
          {mockExpenses.slice(0, 3).map((e) => (
            <div
              key={e.id}
              className={cn('flex items-center gap-3 border-b border-border px-4 last:border-b-0', compact ? 'py-2' : 'py-3.5')}
            >
              <span className="min-w-0 flex-1 truncate text-[14px]">{e.description}</span>
              <span className="text-[12px] text-muted-foreground">{e.category}</span>
              <span className={cn('w-20 shrink-0 text-right tabular-nums', numeral === 'serif' ? 'font-serif-kpi text-[15px]' : 'text-[14px]', numeral === 'mono' && 'font-mono')}>
                {formatCurrency(e.amount)}
              </span>
            </div>
          ))}
        </div>

        <div className={cn(surfaceClass, 'flex items-center justify-between gap-3 px-4', compact ? 'py-2.5' : 'py-4')} style={{ borderRadius: 'var(--sb-radius)' }}>
          <label htmlFor="sb-notify" className="text-[14px]">
            Påminn mig när en kategori går över
          </label>
          <Switch
            id="sb-notify"
            checked={notify}
            onCheckedChange={setNotify}
            className="data-[state=checked]:bg-[var(--sb-accent)]"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {mockCategories.map((c, i) => (
            <span
              key={c.name}
              className={cn('border px-3 py-1 text-[12px]', i === 0 ? 'text-white' : 'border-border text-muted-foreground')}
              style={{
                borderRadius: 'var(--sb-radius)',
                ...(i === 0 ? { background: 'var(--sb-accent)', borderColor: 'var(--sb-accent)' } : {}),
              }}
            >
              {c.name}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">Som tokens i globals.css</span>
          <button
            type="button"
            onClick={copyTokens}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] transition-colors hover:border-foreground/40"
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied ? 'Kopierat' : 'Kopiera tokens'}
          </button>
        </div>
        <pre className="mt-2 overflow-x-auto rounded-md bg-secondary/60 p-3 font-mono text-[11px] leading-relaxed" translate="no">
          {css}
        </pre>
      </div>
    </div>
  )
}
