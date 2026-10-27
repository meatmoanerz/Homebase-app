'use client'

import {
  Bar,
  Cell,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatPeriodShort } from '@/lib/analytics/format'

export interface TrendPoint {
  period: string
  value: number
  income?: number | null
  /** Part of the selected timeframe — drawn in full colour, the rest muted. */
  inRange: boolean
}

interface AnalyticsTrendChartProps {
  data: TrendPoint[]
  showIncome?: boolean
  height?: number
  onSelectPeriod?: (period: string) => void
  selectedPeriod?: string | null
}

/** Short axis labels: 45 000 → "45 tkr", 1 200 000 → "1,2 mkr". */
function formatAxis(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} mkr`
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} tkr`
  return String(Math.round(v))
}

function TrendTooltip({
  active,
  payload,
  showIncome,
}: {
  active?: boolean
  payload?: Array<{ payload: TrendPoint }>
  showIncome?: boolean
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <div className="font-medium capitalize mb-1">{formatPeriodShort(p.period, true)}</div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-sm bg-chart-spend" />
        <span className="text-muted-foreground">Utgifter</span>
        <span className="ml-auto font-medium">{formatCurrency(p.value)}</span>
      </div>
      {showIncome && p.income != null && (
        <div className="flex items-center gap-2 mt-0.5">
          <span className="w-2 h-0.5 bg-chart-income" />
          <span className="text-muted-foreground">Inkomst</span>
          <span className="ml-auto font-medium">{formatCurrency(p.income)}</span>
        </div>
      )}
    </div>
  )
}

export function AnalyticsTrendChart({
  data,
  showIncome = false,
  height = 200,
  onSelectPeriod,
  selectedPeriod,
}: AnalyticsTrendChartProps) {
  const withData = data.filter((d) => d.value > 0)
  const average = withData.length > 1 ? withData.reduce((s, d) => s + d.value, 0) / withData.length : null
  const hasIncome = showIncome && data.some((d) => (d.income ?? 0) > 0)

  return (
    <div>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-2">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-chart-spend" />Utgifter</span>
        {hasIncome && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-chart-income" />Inkomst</span>
        )}
        {average != null && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 border-t border-dashed border-muted-foreground/70" />
            Snitt {formatCurrency(average)}
          </span>
        )}
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <ComposedChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey="period"
              tickFormatter={(p: string) => formatPeriodShort(p)}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              interval={data.length <= 12 ? 0 : 'preserveStartEnd'}
              minTickGap={2}
            />
            <YAxis
              tickFormatter={formatAxis}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ fill: 'var(--secondary)', opacity: 0.6 }}
              content={<TrendTooltip showIncome={hasIncome} />}
            />
            {average != null && (
              <ReferenceLine
                y={average}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.5}
                strokeDasharray="3 3"
              />
            )}
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              // Animating per-bar Cells can leave the bars undrawn after a filter change.
              isAnimationActive={false}
              onClick={(entry: { payload?: TrendPoint }) => {
                if (entry?.payload && onSelectPeriod) onSelectPeriod(entry.payload.period)
              }}
              className={onSelectPeriod ? 'cursor-pointer' : undefined}
            >
              {data.map((d) => (
                <Cell
                  key={d.period}
                  fill={d.inRange ? 'var(--chart-spend)' : 'var(--chart-muted)'}
                  fillOpacity={selectedPeriod && d.period !== selectedPeriod && d.inRange ? 0.75 : 1}
                />
              ))}
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
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
