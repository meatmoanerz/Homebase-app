'use client'

import {
  Bar,
  Cell,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatPeriodShort } from '@/lib/analytics/format'

export interface ForecastPoint {
  period: string
  kind: 'history' | 'current' | 'future'
  /** Spent (history, and so far in the running period). */
  actual: number
  /** Forecast part: the expected remainder (current) or the whole month (future). */
  forecast: number
  low: number | null
  high: number | null
  income: number | null
  /** History month left out of the forecast (too little data). */
  incomplete?: boolean
}

interface ForecastChartProps {
  data: ForecastPoint[]
  showIncome?: boolean
  height?: number
}

function formatAxis(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} mkr`
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} tkr`
  return String(Math.round(v))
}

function ForecastTooltip({ active, payload, showIncome }: { active?: boolean; payload?: Array<{ payload: ForecastPoint }>; showIncome?: boolean }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const total = p.actual + p.forecast
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs min-w-[160px]">
      <div className="font-medium capitalize mb-1">
        {formatPeriodShort(p.period, true)}
        <span className="ml-1.5 font-normal text-muted-foreground">
          {p.kind === 'history' ? 'faktiskt' : p.kind === 'current' ? 'pågår' : 'prognos'}
        </span>
      </div>
      {p.kind === 'current' && (
        <Row label="Hittills" value={formatCurrency(p.actual)} />
      )}
      <Row label={p.kind === 'history' ? 'Utgifter' : 'Landar på'} value={`${p.kind === 'history' ? '' : '~'}${formatCurrency(total)}`} strong />
      {p.low != null && p.high != null && p.kind !== 'history' && (
        <Row label="Spann" value={`${formatCurrency(p.low)} – ${formatCurrency(p.high)}`} />
      )}
      {showIncome && p.income != null && <Row label="Inkomst" value={formatCurrency(p.income)} />}
      {p.incomplete && <div className="text-muted-foreground mt-1">Ofullständig — används inte i prognosen</div>}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold' : 'font-medium'}>{value}</span>
    </div>
  )
}

/**
 * History as solid bars, the forecast as lighter bars stacked on top of what
 * is already spent, with the likely range as a whisker. One axis (kr).
 */
export function ForecastChart({ data, showIncome = false, height = 220 }: ForecastChartProps) {
  const hasIncome = showIncome && data.some((d) => (d.income ?? 0) > 0)
  const chartData = data.map((d) => {
    const total = d.actual + d.forecast
    return {
      ...d,
      // Whisker relative to the top of the stacked bar.
      // null = no whisker (history has no uncertainty)
      err: d.kind !== 'history' && d.low != null && d.high != null
        ? [Math.max(0, total - d.low), Math.max(0, d.high - total)] as [number, number]
        : null,
    }
  })

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-2">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-chart-spend" />Faktiskt</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-chart-spend/35 ring-1 ring-inset ring-chart-spend/60" />Prognos</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-foreground/50" />Troligt spann</span>
        {hasIncome && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-chart-income" />Inkomst</span>
        )}
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 4, left: -12, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey="period"
              tickFormatter={(p: string) => formatPeriodShort(p)}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              interval={chartData.length <= 12 ? 0 : 'preserveStartEnd'}
              minTickGap={2}
            />
            <YAxis
              tickFormatter={formatAxis}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip cursor={{ fill: 'var(--secondary)', opacity: 0.6 }} content={<ForecastTooltip showIncome={hasIncome} />} />
            <Bar dataKey="actual" stackId="s" fill="var(--chart-spend)" maxBarSize={26} isAnimationActive={false}>
              {chartData.map((d) => (
                // Round the top only when no forecast segment sits on it.
                <Cell
                  key={d.period}
                  fill={d.incomplete ? 'var(--chart-muted)' : 'var(--chart-spend)'}
                  radius={d.forecast > 0 ? 0 : ([4, 4, 0, 0] as unknown as number)}
                />
              ))}
            </Bar>
            <Bar
              dataKey="forecast"
              stackId="s"
              fill="var(--chart-spend)"
              fillOpacity={0.35}
              stroke="var(--chart-spend)"
              strokeOpacity={0.6}
              strokeDasharray="3 2"
              radius={[4, 4, 0, 0]}
              maxBarSize={26}
              isAnimationActive={false}
            >
              <ErrorBar dataKey="err" width={5} strokeWidth={1.5} stroke="var(--foreground)" strokeOpacity={0.5} direction="y" />
            </Bar>
            {hasIncome && (
              <Line
                dataKey="income"
                type="monotone"
                stroke="var(--chart-income)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
