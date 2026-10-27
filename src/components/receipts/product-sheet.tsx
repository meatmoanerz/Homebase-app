'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp, TrendingDown, Repeat } from 'lucide-react'
import { BottomSheet } from '@/components/shared/bottom-sheet'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { formatChange } from '@/lib/analytics/format'
import { PRODUCT_GROUPS, quantityLabel, type ProductStat } from '@/lib/receipts/receipt-analytics'
import { useSetProductGroup } from '@/hooks/use-receipts'
import { cn } from '@/lib/utils/cn'

export function unitLabel(unit: string | null): string {
  return unit === 'kg' ? 'kr/kg' : unit === 'l' ? 'kr/l' : 'kr/st'
}

function PriceTooltip({ active, payload, unit }: { active?: boolean; payload?: Array<{ payload: { date: string; price: number; store: string | null } }>; unit: string | null }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <div className="font-medium">{formatDate(p.date, 'medium')}</div>
      <div className="text-muted-foreground">{p.store || 'Okänd butik'}</div>
      <div className="font-semibold mt-0.5">{formatCurrency(p.price)} <span className="font-normal text-muted-foreground">{unitLabel(unit)}</span></div>
    </div>
  )
}

/** Price development and purchase history for one product. */
export function ProductSheet({
  product,
  onOpenChange,
  onLinked,
}: {
  product: ProductStat | null
  onOpenChange: (open: boolean) => void
  /** Called with the product id when lines were linked to a new product. */
  onLinked?: (productId: string) => void
}) {
  const [now] = useState(() => Date.now())
  const setGroup = useSetProductGroup()

  const chooseGroup = (groupKey: string) => {
    if (!product || setGroup.isPending) return
    setGroup.mutate(
      {
        productId: product.productId,
        name: product.name,
        unit: product.unit ?? (product.purchases.some((p) => !Number.isInteger(p.quantity)) ? 'kg' : 'st'),
        groupKey,
        lineIds: product.purchases.map((p) => p.lineId),
        rawNames: product.rawNames,
        articleNumbers: product.articleNumbers,
      },
      { onSuccess: (id) => { if (!product.productId) onLinked?.(id) } }
    )
  }
  const data = product?.purchases.map((p) => ({ date: p.date, price: Math.round(p.unitPrice * 100) / 100, store: p.store })) ?? []
  const last = product?.purchases[product.purchases.length - 1]
  const daysSince = last ? Math.round((now - Date.parse(last.date)) / 86_400_000) : null

  return (
    <BottomSheet
      open={!!product}
      onOpenChange={onOpenChange}
      title={product?.name}
      subtitle={product ? `${product.group.label} · köpt ${product.count} ${product.count === 1 ? 'gång' : 'gånger'}` : undefined}
    >
      {product && (
        <div className="space-y-5">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="label-caps text-muted-foreground">Varugrupp</span>
              <span className="text-[11px] text-muted-foreground">
                {setGroup.isPending ? 'Sparar…' : product.groupChosen ? 'vald av dig' : 'gissad från namnet — tryck för att ändra'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_GROUPS.map((g) => {
                const active = product.group.key === g.key
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => !active || !product.groupChosen ? chooseGroup(g.key) : undefined}
                    disabled={setGroup.isPending}
                    aria-pressed={active}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[12px] whitespace-nowrap transition-colors',
                      active
                        ? product.groupChosen
                          ? 'bg-hb-nav text-hb-nav-foreground border-hb-nav'
                          : 'bg-hb-cognac/15 text-hb-cognac-deep border-hb-cognac/40 border-dashed'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {g.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Senaste pris" value={`${formatCurrency(last?.unitPrice ?? 0)}`} hint={unitLabel(product.unit)} strong />
            <Stat
              label="Mot tidigare snitt"
              value={formatChange(product.priceChange)}
              tone={product.priceChange == null ? undefined : product.priceChange > 0.02 ? 'up' : product.priceChange < -0.02 ? 'down' : undefined}
            />
            <Stat label="Lägst / högst" value={`${formatCurrency(product.minPrice)} – ${formatCurrency(product.maxPrice)}`} />
            <Stat label="Totalt spenderat" value={formatCurrency(product.total)} />
          </div>

          {product.intervalDays != null && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-secondary/50 px-3.5 py-3 text-[13px]">
              <Repeat className="w-4 h-4 text-hb-cognac-deep shrink-0" />
              <span>
                Köps ungefär var {Math.max(1, Math.round(product.intervalDays))}:e dag
                {daysSince != null && ` · senast för ${daysSince} ${daysSince === 1 ? 'dag' : 'dagar'} sedan`}
                {daysSince != null && daysSince > product.intervalDays * 1.2 && (
                  <span className="text-hb-cognac-deep font-medium"> — dags snart igen?</span>
                )}
              </span>
            </div>
          )}

          <div>
            <div className="label-caps text-muted-foreground mb-2">Prisutveckling ({unitLabel(product.unit)})</div>
            {data.length < 2 ? (
              <p className="text-sm text-muted-foreground">Prisgrafen visas när varan köpts minst två gånger.</p>
            ) : (
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={16}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => `${Math.round(v)} kr`}
                    />
                    <Tooltip content={<PriceTooltip unit={product.unit} />} cursor={{ stroke: 'var(--border)' }} />
                    <ReferenceLine y={product.avgPrice} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeDasharray="3 3" />
                    <Line
                      dataKey="price"
                      type="monotone"
                      stroke="var(--chart-spend)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: 'var(--chart-spend)', stroke: 'var(--card)', strokeWidth: 2 }}
                      activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {data.length >= 2 && (
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-muted-foreground/70" /> snitt {formatCurrency(product.avgPrice)}
              </div>
            )}
          </div>

          <div>
            <div className="label-caps text-muted-foreground mb-2">Köp</div>
            <ul className="bg-secondary/30 rounded-2xl divide-y divide-border/60 overflow-hidden">
              {[...product.purchases].reverse().map((p, i) => (
                <li key={`${p.receiptId}-${i}`} className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                  <span>
                    <span className="font-medium">{formatDate(p.date, 'medium')}</span>
                    <span className="text-muted-foreground"> · {p.store || 'Okänd butik'}{quantityLabel(p.quantity, product.unit) && ` · ${quantityLabel(p.quantity, product.unit)}`}</span>
                  </span>
                  <span className="text-right">
                    <span className="font-serif font-medium">{formatCurrency(p.total)}</span>
                    {p.quantity !== 1 && <span className="block text-[10px] text-muted-foreground">{formatCurrency(p.unitPrice)} {unitLabel(product.unit)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}

function Stat({ label, value, hint, strong, tone }: { label: string; value: string; hint?: string; strong?: boolean; tone?: 'up' | 'down' }) {
  return (
    <div className="bg-secondary/40 rounded-2xl px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('font-serif-kpi mt-0.5 flex items-baseline gap-1', strong ? 'text-[20px]' : 'text-[15px]', tone === 'up' && 'text-destructive', tone === 'down' && 'text-hb-green')}>
        {tone === 'up' && <TrendingUp className="w-3.5 h-3.5 self-center" />}
        {tone === 'down' && <TrendingDown className="w-3.5 h-3.5 self-center" />}
        {value}
        {hint && <span className="text-[11px] text-muted-foreground font-sans">{hint}</span>}
      </div>
    </div>
  )
}
