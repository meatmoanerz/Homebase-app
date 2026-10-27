'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Receipt,
  Search,
  X,
  ChevronRight,
  Sparkles,
  TrendingUp,
  CalendarDays,
  Tag,
  Link2,
  Repeat,
  ShoppingBasket,
  ArrowRightLeft,
} from 'lucide-react'
import { useReceipts, useReceiptLines } from '@/hooks/use-receipts'
import { useAllExpenses } from '@/hooks/use-analytics'
import { formatCurrency, formatDate, formatPrice } from '@/lib/utils/formatters'
import { formatChange, formatPeriodShort } from '@/lib/analytics/format'
import { periodsBetween } from '@/lib/analytics/analytics'
import {
  groupTotals,
  perLabel,
  matchReceiptsToExpenses,
  monthlyTotals,
  productKey,
  productStats,
  weekdayPattern,
  type ArticleSwitch,
  type ProductStat,
  type ReceiptHead,
  type ReceiptLine,
} from '@/lib/receipts/receipt-analytics'
import { AnalyticsTrendChart } from '@/components/analytics/analytics-trend-chart'
import { Sparkline } from '@/components/analytics/analytics-forecast-view'
import { BottomSheet } from '@/components/shared/bottom-sheet'
import { ProductSheet } from '@/components/receipts/product-sheet'
import { ReceiptSheet } from '@/components/receipts/receipt-sheet'
import { ReceiptUploadButton } from '@/components/receipts/receipt-upload-button'
import { ReceiptsPageSkeleton } from '@/components/shared/page-skeletons'
import { cn } from '@/lib/utils/cn'

type Tab = 'overview' | 'receipts' | 'products'
type ProductSort = 'count' | 'total' | 'change'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'overview', label: 'Översikt' },
  { value: 'receipts', label: 'Kvitton' },
  { value: 'products', label: 'Varor' },
]

const GROCERY_RE = /\bica\b|hemköp|coop|willys|lidl|city gross|mathem|tempo|matsmart|netto/i

interface ReceiptInsight {
  id: string
  icon: typeof Sparkles
  tone: 'good' | 'warning' | 'neutral'
  title: string
  text: string
  onClick?: () => void
}

export default function ReceiptsPage() {
  const { data: receiptRows = [], isLoading: receiptsLoading } = useReceipts(1000)
  const { data: lines = [], isLoading: linesLoading } = useReceiptLines()
  const { data: expenses = [] } = useAllExpenses()

  const [tab, setTab] = useState<Tab>('overview')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ProductSort>('count')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null)
  const [openProductKey, setOpenProductKey] = useState<string | null>(null)
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null)
  // "Today" captured once per visit so render stays pure.
  const [now] = useState(() => Date.now())

  const receipts = receiptRows as unknown as ReceiptHead[]
  const receiptById = useMemo(() => new Map(receipts.map((r) => [r.id, r])), [receipts])
  const products = useMemo(() => productStats(lines, receiptById), [lines, receiptById])
  const productByKey = useMemo(() => new Map(products.map((p) => [p.key, p])), [products])
  const groups = useMemo(() => groupTotals(products), [products])
  const linesByReceipt = useMemo(() => {
    const map = new Map<string, ReceiptLine[]>()
    for (const l of lines) map.set(l.receipt_id, [...(map.get(l.receipt_id) || []), l])
    return map
  }, [lines])

  // Receipts ↔ card/bank purchases, and how much of the grocery shopping has a receipt.
  const groceryExpenses = useMemo(() => {
    if (receipts.length === 0) return []
    const first = receipts.reduce((m, r) => (r.purchase_date < m ? r.purchase_date : m), receipts[0].purchase_date)
    return expenses.filter((e) => e.date >= first && GROCERY_RE.test(e.description) && e.amount > 0)
  }, [expenses, receipts])
  const matches = useMemo(() => matchReceiptsToExpenses(receipts, groceryExpenses), [receipts, groceryExpenses])

  const stats = useMemo(() => {
    const total = receipts.reduce((s, r) => s + Number(r.total_amount), 0)
    const itemLines = lines.filter((l) => !l.is_deposit && !/^pant\b/i.test(l.raw_name))
    const discount = lines.reduce((s, l) => s + Number(l.discount_amount || 0), 0)
    return {
      total,
      count: receipts.length,
      avgReceipt: receipts.length ? total / receipts.length : 0,
      avgItems: receipts.length ? itemLines.length / receipts.length : 0,
      discount,
    }
  }, [receipts, lines])

  const monthly = useMemo(() => {
    const totals = monthlyTotals(receipts)
    const months = [...totals.keys()].sort()
    if (months.length === 0) return []
    return periodsBetween(months[0], months[months.length - 1]).map((m) => ({ period: m, value: totals.get(m) || 0, inRange: true }))
  }, [receipts])

  const priceMovers = useMemo(
    () =>
      products
        .filter((p) => p.priceChange != null && Math.abs(p.priceChange) >= 0.05 && p.group.key !== 'pant')
        .sort((a, b) => Math.abs(b.priceChange!) - Math.abs(a.priceChange!))
        .slice(0, 5),
    [products]
  )
  // The store replaced an article with another one of the same product.
  const switches = useMemo(
    () =>
      products
        .flatMap((p) => p.switches.filter((s) => s.replaced).map((s) => ({ product: p, s })))
        .sort((a, b) => b.s.date.localeCompare(a.s.date))
        .slice(0, 5),
    [products]
  )
  const staples = useMemo(
    () => products.filter((p) => p.count >= 3 && p.group.key !== 'pant').sort((a, b) => b.count - a.count).slice(0, 6),
    [products]
  )

  const insights = useMemo<ReceiptInsight[]>(() => {
    const out: ReceiptInsight[] = []
    const itemsTotal = groups.reduce((s, g) => s + g.total, 0)
    const top = groups[0]
    if (top && itemsTotal > 0) {
      out.push({
        id: 'top-group',
        icon: ShoppingBasket,
        tone: 'neutral',
        title: `${top.group.label}: ${Math.round((top.total / itemsTotal) * 100)} % av kvittona`,
        text: `${formatCurrency(top.total)} på ${top.count} köp — den största varugruppen.`,
        onClick: () => setOpenGroupKey(top.group.key),
      })
    }
    const up = priceMovers.find((p) => (p.priceChange ?? 0) > 0)
    if (up) {
      out.push({
        id: 'price-up',
        icon: TrendingUp,
        tone: 'warning',
        title: `${up.name} har blivit dyrare`,
        text: `${formatChange(up.priceChange)} mot tidigare snitt — senast ${formatPrice(up.latestPrice ?? 0)}${perLabel(up.basis)}.`,
        onClick: () => setOpenProductKey(up.key),
      })
    }
    const recentSwitch = switches.find((x) => now - Date.parse(x.s.date) < 120 * 86_400_000)
    if (recentSwitch) {
      out.push({
        id: 'switch',
        icon: ArrowRightLeft,
        tone: 'warning',
        title: `${recentSwitch.product.name}: ny artikel`,
        text: `${recentSwitch.s.from.name} har ersatts av ${recentSwitch.s.to.name} (${formatDate(recentSwitch.s.date, 'medium')})${switchChange(recentSwitch.s)}.`,
        onClick: () => setOpenProductKey(recentSwitch.product.key),
      })
    }
    const due = staples
      .filter((p) => p.intervalDays != null)
      .map((p) => ({ p, overdue: (now - Date.parse(p.lastDate)) / 86_400_000 - (p.intervalDays ?? 0) }))
      .sort((a, b) => b.overdue - a.overdue)[0]
    if (due && due.overdue > 0) {
      out.push({
        id: 'due',
        icon: Repeat,
        tone: 'neutral',
        title: `Dags för ${due.p.name.toLowerCase()}?`,
        text: `Brukar köpas var ${Math.round(due.p.intervalDays!)}:e dag, senast ${formatDate(due.p.lastDate, 'medium')}.`,
        onClick: () => setOpenProductKey(due.p.key),
      })
    }
    const weekday = weekdayPattern(receipts)
    if (weekday) {
      out.push({
        id: 'weekday',
        icon: CalendarDays,
        tone: 'neutral',
        title: `Du handlar oftast på ${weekday.label}`,
        text: `${Math.round(weekday.share * 100)} % av kvittona. En större veckohandel brukar ge färre impulsköp än många små.`,
      })
    }
    if (groceryExpenses.length > 0) {
      const covered = matches.size
      out.push({
        id: 'coverage',
        icon: Link2,
        tone: covered / groceryExpenses.length < 0.5 ? 'warning' : 'good',
        title: `Kvitto finns för ${covered} av ${groceryExpenses.length} matbutiksköp`,
        text: 'Ju fler kvitton, desto säkrare prisanalys och varugrupper. Spara kvittot i Kivra/ICA-appen och be Claude läsa in det.',
      })
    }
    if (stats.discount > 0) {
      out.push({
        id: 'discount',
        icon: Tag,
        tone: 'good',
        title: `${formatCurrency(stats.discount)} sparat på rabatter`,
        text: 'Erbjudanden och bonus som dragits på kvittona.',
      })
    }
    return out
  }, [groups, priceMovers, switches, staples, receipts, groceryExpenses, matches, stats.discount, now])

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => p.group.key !== 'pant')
      .filter((p) => !groupFilter || p.group.key === groupFilter)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === 'count' ? b.count - a.count || b.total - a.total
          : sort === 'total' ? b.total - a.total
            : Math.abs(b.priceChange ?? 0) - Math.abs(a.priceChange ?? 0)
      )
  }, [products, query, groupFilter, sort])

  const receiptsByMonth = useMemo(() => {
    const map = new Map<string, ReceiptHead[]>()
    for (const r of [...receipts].sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))) {
      const m = r.purchase_date.slice(0, 7)
      map.set(m, [...(map.get(m) || []), r])
    }
    return [...map.entries()]
  }, [receipts])

  if (receiptsLoading || linesLoading) return <ReceiptsPageSkeleton />

  const openReceipt = openReceiptId ? receiptById.get(openReceiptId) ?? null : null
  const openProduct = openProductKey ? productByKey.get(openProductKey) ?? null : null
  const openGroup = openGroupKey ? groups.find((g) => g.group.key === openGroupKey) ?? null : null
  const itemsTotal = groups.reduce((s, g) => s + g.total, 0)

  if (receipts.length === 0) {
    return (
      <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-3xl p-8 md:p-12 text-center shadow-sm mt-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-hb-cognac/10 grid place-items-center mb-5">
            <Receipt className="w-7 h-7 text-hb-cognac" />
          </div>
          <h2 className="font-serif text-xl font-medium mb-2">Inga kvitton ännu</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Fotografera ett kvitto eller dela ett digitalt kvitto från Kivra/ICA. Då börjar appen följa priser,
            varugrupper och dina basvaror.
          </p>
          <ReceiptUploadButton className="mt-6 max-w-sm mx-auto" onSaved={(id) => setOpenReceiptId(id)} />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-4 max-w-3xl mx-auto">
      <div className="hidden md:block">
        <h1 className="font-serif text-[32px] font-medium tracking-tight">Kvitton</h1>
        <p className="text-sm text-muted-foreground mt-1">Vad du handlar, vad det kostar och hur priserna rör sig</p>
      </div>

      <div className="sticky top-[63px] md:top-0 z-30 -mx-4 px-4 md:-mx-2 md:px-2 py-2 bg-background/95 backdrop-blur-md">
        <div className="flex gap-1 bg-secondary rounded-full p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'flex-1 py-1.5 rounded-full text-[13px] font-medium transition-all',
                tab === t.value ? 'bg-hb-nav text-hb-nav-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ReceiptUploadButton onSaved={(id) => setOpenReceiptId(id)} />

      {tab === 'overview' && (
        <>
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-3xl px-5 py-5 md:px-6 shadow-sm"
          >
            <div className="label-caps text-muted-foreground">Handlat med kvitto</div>
            <div className="font-serif-hero text-[40px] md:text-[46px] leading-[1.05] mt-1">{formatCurrency(stats.total)}</div>
            <div className="text-[12px] text-muted-foreground mt-1">
              {stats.count} kvitton · {formatDay(receipts[receipts.length - 1]?.purchase_date)} – {formatDay(receipts[0]?.purchase_date)}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Tile label="Snitt/kvitto" value={formatCurrency(stats.avgReceipt)} />
              <Tile label="Varor/kvitto" value={stats.avgItems.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} />
              <Tile label="Unika varor" value={String(products.filter((p) => p.group.key !== 'pant').length)} />
            </div>
          </motion.section>

          {monthly.length > 1 && (
            <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
              <h2 className="font-serif text-[19px] font-medium tracking-tight mb-3">Per månad</h2>
              <AnalyticsTrendChart data={monthly} height={170} seriesLabel="Kvitton" />
            </section>
          )}

          {insights.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-serif text-[19px] font-medium tracking-tight px-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-hb-cognac" />
                Insikter
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {insights.slice(0, 6).map((i) => (
                  <InsightCard key={i.id} insight={i} />
                ))}
              </div>
            </section>
          )}

          <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-[19px] font-medium tracking-tight">Varugrupper</h2>
              <span className="text-[11px] text-muted-foreground">automatiskt utifrån varunamn</span>
            </div>
            <ul className="mt-2 -mx-1">
              {groups.map((g) => (
                <li key={g.group.key}>
                  <button
                    type="button"
                    onClick={() => setOpenGroupKey(g.group.key)}
                    className="w-full text-left px-1 py-2 rounded-xl hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-medium">{g.group.label}</span>
                      <span className="flex items-center gap-1">
                        <span className="font-serif text-[15px] font-medium">{formatCurrency(g.total)}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-chart-spend" style={{ width: `${(g.total / (groups[0]?.total || 1)) * 100}%` }} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {Math.round((g.total / (itemsTotal || 1)) * 100)} % · {g.count} köp
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
              <h2 className="font-serif text-[19px] font-medium tracking-tight">Prisrörelser</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Jämförpris (kr/kg, kr/l) eller samma artikel, mot tidigare snitt</p>
              {priceMovers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Inga tydliga prisändringar än — kräver flera köp av samma vara.</p>
              ) : (
                <ul className="mt-2 -mx-1">
                  {priceMovers.map((p) => (
                    <ProductRow key={p.key} product={p} onClick={() => setOpenProductKey(p.key)} showChange />
                  ))}
                </ul>
              )}
            </section>
            <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
              <h2 className="font-serif text-[19px] font-medium tracking-tight">Basvaror</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Det du köper om och om igen</p>
              {staples.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Visas när en vara köpts minst tre gånger.</p>
              ) : (
                <ul className="mt-2 -mx-1">
                  {staples.map((p) => (
                    <li key={p.key}>
                      <button
                        type="button"
                        onClick={() => setOpenProductKey(p.key)}
                        className="w-full flex items-center justify-between gap-3 px-1 py-2 rounded-xl hover:bg-secondary/50 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium truncate">{p.name}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {p.count} köp{p.intervalDays != null && ` · var ${Math.max(1, Math.round(p.intervalDays))}:e dag`}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block font-serif text-[15px] font-medium">{formatPrice(p.avgPrice)}</span>
                          <span className="block text-[10px] text-muted-foreground">snitt{perLabel(p.basis)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {switches.length > 0 && (
            <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
              <h2 className="font-serif text-[19px] font-medium tracking-tight">Artikelbyten</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">När butiken ersatt en vara med en annan artikel av samma produkt</p>
              <ul className="mt-2 -mx-1">
                {switches.map(({ product: p, s }) => (
                  <li key={`${p.key}-${s.to.key}`}>
                    <button
                      type="button"
                      onClick={() => setOpenProductKey(p.key)}
                      className="w-full flex items-center justify-between gap-3 px-1 py-2 rounded-xl hover:bg-secondary/50 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium truncate">{p.name}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {s.from.name} → {s.to.name}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-[12px]">{formatDate(s.date, 'medium')}</span>
                        {s.priceChange != null && (
                          <span className={cn('block text-[11px] font-medium', s.priceChange > 0.02 ? 'text-destructive' : s.priceChange < -0.02 ? 'text-hb-green' : 'text-muted-foreground')}>
                            {formatChange(s.priceChange)}{s.perPack ? ' /förp' : ''}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'receipts' && (
        <div className="space-y-4">
          {receiptsByMonth.map(([month, list]) => (
            <section key={month}>
              <div className="flex items-baseline justify-between px-1 mb-1.5">
                <h2 className="font-serif text-[17px] font-medium tracking-tight capitalize">{formatPeriodShort(month, true)}</h2>
                <span className="text-[12px] text-muted-foreground">{formatCurrency(list.reduce((s, r) => s + Number(r.total_amount), 0))}</span>
              </div>
              <ul className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden">
                {list.map((r) => {
                  const store = r.store?.chain || r.store?.name || '?'
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setOpenReceiptId(r.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
                      >
                        <span className="w-9 h-9 rounded-xl bg-hb-cognac/12 text-hb-cognac-deep grid place-items-center font-serif text-[13px] font-semibold shrink-0">
                          {store.slice(0, 3).toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14px] font-medium truncate">{r.store?.name || store}</span>
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {new Date(`${r.purchase_date}T12:00:00`).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {' · '}{r.item_count} varor
                            {matches.has(r.id) && <Link2 className="w-3 h-3 text-hb-green" aria-label="Matchad mot utgift" />}
                          </span>
                        </span>
                        <span className="font-serif text-[15px] font-medium shrink-0">{formatCurrency(Number(r.total_amount))}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3.5 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök vara…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Rensa sökning" className="text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            <Chip active={!groupFilter} onClick={() => setGroupFilter(null)}>Alla</Chip>
            {groups.map((g) => (
              <Chip key={g.group.key} active={groupFilter === g.group.key} onClick={() => setGroupFilter(groupFilter === g.group.key ? null : g.group.key)}>
                {g.group.label}
              </Chip>
            ))}
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] text-muted-foreground">{visibleProducts.length} varor</span>
            <div className="flex gap-0.5 bg-secondary rounded-full p-0.5 text-[11px]">
              {([['count', 'Oftast'], ['total', 'Mest kr'], ['change', 'Prisändring']] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSort(v)}
                  className={cn('px-2.5 py-1 rounded-full transition-colors', sort === v ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden px-3">
            {visibleProducts.slice(0, 150).map((p) => (
              <ProductRow key={p.key} product={p} onClick={() => setOpenProductKey(p.key)} showChange={sort === 'change'} spark />
            ))}
            {visibleProducts.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Inga varor matchar.</li>}
          </ul>
        </div>
      )}

      <ReceiptSheet
        receipt={openReceipt}
        lines={openReceipt ? linesByReceipt.get(openReceipt.id) ?? [] : []}
        matchedExpense={openReceipt ? matches.get(openReceipt.id) ?? null : null}
        onOpenChange={(o) => !o && setOpenReceiptId(null)}
        onSelectProduct={(line) => {
          setOpenReceiptId(null)
          setOpenProductKey(productKey(line))
        }}
      />
      <ProductSheet
        product={openProduct}
        allProducts={products}
        onOpenChange={(o) => !o && setOpenProductKey(null)}
        onLinked={(id) => setOpenProductKey(`p:${id}`)}
      />
      <BottomSheet
        open={!!openGroup}
        onOpenChange={(o) => !o && setOpenGroupKey(null)}
        title={openGroup?.group.label}
        subtitle={openGroup ? `${formatCurrency(openGroup.total)} · ${openGroup.count} köp` : undefined}
      >
        <ul className="-mx-1">
          {products
            .filter((p) => p.group.key === openGroupKey)
            .sort((a, b) => b.total - a.total)
            .map((p) => (
              <ProductRow
                key={p.key}
                product={p}
                onClick={() => {
                  setOpenGroupKey(null)
                  setOpenProductKey(p.key)
                }}
              />
            ))}
        </ul>
      </BottomSheet>
    </div>
  )
}

function ProductRow({ product, onClick, showChange, spark }: { product: ProductStat; onClick: () => void; showChange?: boolean; spark?: boolean }) {
  const change = product.priceChange
  const prices = product.purchases.filter((p) => p.price != null).map((p) => p.price!)
  const variants = product.articles.length
  return (
    <li>
      <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-1 py-2.5 rounded-xl hover:bg-secondary/40 text-left">
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-[14px] font-medium truncate">{product.name}</span>
            {product.switches.some((s) => s.replaced) && (
              <ArrowRightLeft className="w-3 h-3 text-hb-amber shrink-0" aria-label="Butiken har bytt artikel" />
            )}
          </span>
          <span className="block text-[11px] text-muted-foreground truncate">
            {product.group.label} · {product.count} köp{variants > 1 && ` · ${variants} varianter`} · {formatCurrency(product.total)}
          </span>
        </span>
        {spark && prices.length >= 2 && (
          <Sparkline values={prices} up={(change ?? 0) > 0} width={56} height={22} zeroBased={false} />
        )}
        <span className="text-right shrink-0 min-w-[64px]">
          <span className="block font-serif text-[14px] font-medium">{formatPrice(product.avgPrice)}</span>
          {showChange && change != null ? (
            <span className={cn('block text-[11px] font-medium', change > 0.02 ? 'text-destructive' : change < -0.02 ? 'text-hb-green' : 'text-muted-foreground')}>
              {formatChange(change)}
            </span>
          ) : (
            <span className="block text-[10px] text-muted-foreground">snitt{perLabel(product.basis)}</span>
          )}
        </span>
      </button>
    </li>
  )
}

function switchChange(s: ArticleSwitch): string {
  if (s.priceChange == null || Math.abs(s.priceChange) < 0.02) return ''
  return ` — ${Math.round(Math.abs(s.priceChange) * 100)} % ${s.priceChange > 0 ? 'dyrare' : 'billigare'} ${s.perPack ? 'per förpackning' : `per ${s.to.basis}`}`
}

function InsightCard({ insight }: { insight: ReceiptInsight }) {
  const Icon = insight.icon
  const body = (
    <>
      <div
        className={cn(
          'w-8 h-8 rounded-xl grid place-items-center shrink-0',
          insight.tone === 'warning' && 'bg-hb-amber/15 text-hb-amber',
          insight.tone === 'good' && 'bg-hb-green/15 text-hb-green',
          insight.tone === 'neutral' && 'bg-hb-cognac/12 text-hb-cognac-deep'
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">{insight.title}</div>
        <div className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{insight.text}</div>
      </div>
      {insight.onClick && <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 self-center" />}
    </>
  )
  const cls = 'flex gap-3 bg-card border border-border rounded-2xl px-3.5 py-3 shadow-sm text-left w-full'
  return insight.onClick ? (
    <button type="button" onClick={insight.onClick} className={cn(cls, 'hover:bg-secondary/40 transition-colors')}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-2xl px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      <div className="font-serif-kpi text-[15px] mt-0.5">{value}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-[12px] whitespace-nowrap transition-colors',
        active ? 'bg-hb-nav text-hb-nav-foreground border-hb-nav' : 'bg-card border-border text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function formatDay(date: string | undefined): string {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}
