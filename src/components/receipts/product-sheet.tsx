'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp, TrendingDown, Repeat, ArrowRightLeft } from 'lucide-react'
import { BottomSheet } from '@/components/shared/bottom-sheet'
import { ProductVariants } from '@/components/receipts/product-variants'
import { formatCurrency, formatDate, formatPrice } from '@/lib/utils/formatters'
import { formatChange } from '@/lib/analytics/format'
import { PRODUCT_GROUPS, basisLabel, perLabel, purchaseLabel, type ProductStat } from '@/lib/receipts/receipt-analytics'
import { productLines, useSetProductGroup } from '@/hooks/use-receipts'
import { cn } from '@/lib/utils/cn'

const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

interface ChartPoint {
  date: string
  price: number
  store: string | null
  article: string
}

function PriceTooltip({ active, payload, per }: { active?: boolean; payload?: Array<{ payload: ChartPoint }>; per: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <div className="font-medium">{formatDate(p.date, 'medium')} · {p.store || 'Okänd butik'}</div>
      <div className="text-muted-foreground">{p.article}</div>
      <div className="font-semibold mt-0.5">{formatPrice(p.price)}{per}</div>
    </div>
  )
}

/**
 * One product: average comparison price across all its articles first, then
 * the price over time, the store's article switches, each article in detail
 * and every purchase.
 */
export function ProductSheet({
  product,
  allProducts,
  onOpenChange,
  onLinked,
}: {
  product: ProductStat | null
  /** For "add variant". */
  allProducts: ProductStat[]
  onOpenChange: (open: boolean) => void
  /** Called with the product id when the lines now belong to a (new) product. */
  onLinked?: (productId: string) => void
}) {
  const [now] = useState(() => Date.now())
  const setGroup = useSetProductGroup()

  const chooseGroup = (groupKey: string) => {
    if (!product || setGroup.isPending) return
    setGroup.mutate(
      { ...productLines(product), groupKey },
      { onSuccess: (id) => { if (!product.productId) onLinked?.(id) } }
    )
  }

  const unit = product ? basisLabel(product.basis) : ''
  const per = product ? perLabel(product.basis) : ''
  const data: ChartPoint[] =
    product?.purchases
      .filter((p) => p.price != null)
      .map((p) => ({ date: p.date, price: Math.round(p.price! * 100) / 100, store: p.store, article: p.articleName })) ?? []
  const last = product?.purchases[product.purchases.length - 1]
  const daysSince = last ? Math.round((now - Date.parse(last.date)) / 86_400_000) : null
  const variants = product?.articles.length ?? 0
  const missingSize = product ? product.count - product.comparable : 0
  const latestSwitch = product?.switches.filter((s) => s.replaced).pop()

  return (
    <BottomSheet
      open={!!product}
      onOpenChange={onOpenChange}
      title={product?.name}
      subtitle={
        product
          ? `${product.group.label} · ${product.count} köp${variants > 1 ? ` · ${variants} varianter` : ''}`
          : undefined
      }
    >
      {product && (
        <div className="space-y-5">
          <div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={product.basis === 'pack' ? 'Snittpris' : 'Snitt jämförpris'} value={formatPrice(product.avgPrice)} hint={per} strong />
              <Stat
                label="Senaste mot tidigare"
                value={product.priceChange == null ? '–' : formatChange(product.priceChange)}
                hint={product.latestPrice != null ? `senast ${formatPrice(product.latestPrice)}${per}` : undefined}
                tone={product.priceChange == null ? undefined : product.priceChange > 0.02 ? 'up' : product.priceChange < -0.02 ? 'down' : undefined}
              />
              <Stat label="Lägst / högst" value={product.comparable ? `${formatPrice(product.minPrice)} – ${formatPrice(product.maxPrice)}` : '–'} />
              <Stat label="Totalt spenderat" value={formatCurrency(product.total)} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              {product.basis === 'pack'
                ? variants > 1
                  ? 'Förpackningsstorlek saknas, så priset jämförs per förpackning och bara inom samma artikel. Ange storleken under Varianter för jämförpris.'
                  : 'Pris per förpackning. Ange storleken under Varianter för att få jämförpris.'
                : `Jämförpris ${unit} över ${variants > 1 ? 'alla varianter' : 'alla köp'}, viktat efter mängd.`}
              {product.basis !== 'pack' && missingSize > 0 && ` ${missingSize} köp saknar storlek och räknas inte in.`}
            </p>
          </div>

          {latestSwitch && (
            <div className="flex gap-2.5 rounded-2xl bg-hb-amber/10 border border-hb-amber/25 px-3.5 py-3 text-[13px]">
              <ArrowRightLeft className="w-4 h-4 text-hb-amber shrink-0 mt-0.5" />
              <span>
                <span className="font-medium">
                  Butiken bytte artikel {formatDate(latestSwitch.date, 'medium')}
                  {latestSwitch.nameChange && ` (${latestSwitch.nameChange})`}:{' '}
                </span>
                {latestSwitch.from.name} → {latestSwitch.to.name}
                {latestSwitch.priceChange != null && (
                  <span className="text-muted-foreground">
                    {' '}· {formatChange(latestSwitch.priceChange)} {latestSwitch.perPack ? 'per förpackning' : `per ${perLabel(latestSwitch.to.basis).slice(1)}`}
                  </span>
                )}
              </span>
            </div>
          )}

          <div>
            <div className="label-caps text-muted-foreground mb-2">Prisutveckling ({unit})</div>
            {data.length < 2 ? (
              <p className="text-sm text-muted-foreground">Prisgrafen visas när varan köpts minst två gånger.</p>
            ) : (
              <>
                <div className="h-[170px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDate}
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
                        tickFormatter={(v: number) => `${v < 20 ? v.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) : Math.round(v)} kr`}
                      />
                      <Tooltip content={<PriceTooltip per={per} />} cursor={{ stroke: 'var(--border)' }} />
                      <ReferenceLine y={product.avgPrice} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeDasharray="3 3" />
                      {product.switches.filter((s) => s.replaced).map((s) => (
                        <ReferenceLine key={`${s.date}-${s.to.key}`} x={s.date} stroke="var(--hb-amber)" strokeOpacity={0.7} strokeDasharray="2 3" />
                      ))}
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
                <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 border-t border-dashed border-muted-foreground/70" /> snitt {formatPrice(product.avgPrice)}
                  </span>
                  {product.switches.some((s) => s.replaced) && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 border-l border-dashed border-hb-amber" /> ny artikel
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          <ProductVariants key={product.key} product={product} allProducts={allProducts} onLinked={onLinked} />

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
            <div className="label-caps text-muted-foreground mb-2">Alla köp</div>
            <ul className="bg-secondary/30 rounded-2xl divide-y divide-border/60 overflow-hidden">
              {[...product.purchases].reverse().map((p) => {
                const qty = purchaseLabel(p)
                return (
                  <li key={p.lineId} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
                    <span className="min-w-0">
                      <span className="block">
                        <span className="font-medium">{formatDate(p.date, 'medium')}</span>
                        <span className="text-muted-foreground"> · {p.store || 'Okänd butik'}</span>
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {variants > 1 && `${p.articleName}${qty ? ' · ' : ''}`}{qty}
                        {p.discount > 0 && <span className="text-hb-green"> · −{formatCurrency(p.discount)}</span>}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="font-serif font-medium">{formatCurrency(p.total)}</span>
                      {p.price != null && (p.quantity !== 1 || product.basis !== 'pack') && (
                        <span className="block text-[10px] text-muted-foreground">{formatPrice(p.price)}{per}</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

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
                    onClick={() => (!active || !product.groupChosen ? chooseGroup(g.key) : undefined)}
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
        </div>
      )}
    </BottomSheet>
  )
}

function Stat({ label, value, hint, strong, tone }: { label: string; value: string; hint?: string; strong?: boolean; tone?: 'up' | 'down' }) {
  return (
    <div className="bg-secondary/40 rounded-2xl px-3 py-2.5 min-w-0">
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      <div className={cn('font-serif-kpi mt-0.5 flex flex-wrap items-baseline gap-x-1', strong ? 'text-[20px]' : 'text-[15px]', tone === 'up' && 'text-destructive', tone === 'down' && 'text-hb-green')}>
        {tone === 'up' && <TrendingUp className="w-3.5 h-3.5 self-center" />}
        {tone === 'down' && <TrendingDown className="w-3.5 h-3.5 self-center" />}
        {value}
        {hint && <span className="text-[11px] text-muted-foreground font-sans">{hint}</span>}
      </div>
    </div>
  )
}
