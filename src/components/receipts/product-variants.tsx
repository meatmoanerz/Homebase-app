'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Search, Scissors, Check } from 'lucide-react'
import { formatCurrency, formatDate, formatPrice } from '@/lib/utils/formatters'
import { formatChange } from '@/lib/analytics/format'
import { formatPackage, type MeasureUnit } from '@/lib/receipts/package-size'
import { perLabel, purchaseLabel, type ArticleStat, type ProductStat } from '@/lib/receipts/receipt-analytics'
import { productLines, useMergeProducts, useSetArticleSize, useSplitArticle } from '@/hooks/use-receipts'
import { cn } from '@/lib/utils/cn'

const SIZE_UNITS: Array<{ value: string; label: string; unit: MeasureUnit; factor: number }> = [
  { value: 'g', label: 'g', unit: 'kg', factor: 0.001 },
  { value: 'kg', label: 'kg', unit: 'kg', factor: 1 },
  { value: 'ml', label: 'ml', unit: 'l', factor: 0.001 },
  { value: 'dl', label: 'dl', unit: 'l', factor: 0.1 },
  { value: 'l', label: 'l', unit: 'l', factor: 1 },
  { value: 'st', label: 'st', unit: 'st', factor: 1 },
]

const firstWord = (s: string) => s.toLowerCase().split(/[^a-zåäöé]+/).find((w) => w.length > 2) ?? ''

/**
 * The product's articles (store article numbers), newest first. Each opens to
 * its own price history and purchases; pack sizes can be set, articles split
 * off, and other items added as variants of the same product.
 */
export function ProductVariants({
  product,
  allProducts,
  onLinked,
}: {
  product: ProductStat
  allProducts: ProductStat[]
  onLinked?: (productId: string) => void
}) {
  const [openKey, setOpenKey] = useState<string | null>(product.articles.length === 1 ? product.articles[0].key : null)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const merge = useMergeProducts()

  const articles = [...product.articles].sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  const switchTo = new Map(product.switches.map((s) => [s.to.key, s]))

  const candidates = useMemo(() => {
    const own = firstWord(product.name)
    const q = query.trim().toLowerCase()
    return allProducts
      .filter((p) => p.key !== product.key && p.group.key !== 'pant')
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || p.rawNames.some((r) => r.toLowerCase().includes(q)) : firstWord(p.name) === own || p.rawNames.some((r) => firstWord(r) === own)))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [allProducts, product, query])

  const addVariant = (source: ProductStat) => {
    if (merge.isPending) return
    merge.mutate(
      { target: productLines(product), source: productLines(source), groupKey: product.groupChosen ? product.group.key : null },
      {
        onSuccess: (id) => {
          setAdding(false)
          setQuery('')
          if (!product.productId) onLinked?.(id)
        },
      }
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="label-caps text-muted-foreground">{articles.length > 1 ? `Varianter (${articles.length})` : 'Artikel'}</span>
        <span className="text-[11px] text-muted-foreground">tryck för detaljer</span>
      </div>
      <ul className="bg-secondary/30 rounded-2xl divide-y divide-border/60 overflow-hidden">
        {articles.map((a) => (
          <ArticleRow
            key={a.key}
            article={a}
            product={product}
            open={openKey === a.key}
            onToggle={() => setOpenKey(openKey === a.key ? null : a.key)}
            replacedFrom={switchTo.get(a.key)?.replaced ? switchTo.get(a.key)!.from.name : null}
            current={a === articles[0] && articles.length > 1}
          />
        ))}
      </ul>

      {adding ? (
        <div className="mt-2 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök vara att lägga till…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-2 mb-1">
            {query ? 'Träffar' : `Förslag — andra varor som börjar på "${firstWord(product.name)}"`}
          </div>
          {candidates.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-2">Inga förslag. Sök på namnet.</p>
          ) : (
            <ul className="-mx-1">
              {candidates.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    disabled={merge.isPending}
                    onClick={() => addVariant(c)}
                    className="w-full flex items-center justify-between gap-3 px-1 py-2 rounded-xl hover:bg-secondary/50 text-left disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium truncate">{c.name}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {c.articles.length > 1 ? `${c.articles.length} varianter · ` : c.articles[0].name !== c.name ? `${c.articles[0].name} · ` : ''}
                        {c.count} köp
                      </span>
                    </span>
                    <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setAdding(false)} className="text-[12px] text-muted-foreground mt-1">
            Avbryt
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground px-1"
        >
          <Plus className="w-3.5 h-3.5" /> Lägg till variant av samma vara
        </button>
      )}
    </div>
  )
}

function ArticleRow({
  article: a,
  product,
  open,
  onToggle,
  replacedFrom,
  current,
}: {
  article: ArticleStat
  product: ProductStat
  open: boolean
  onToggle: () => void
  replacedFrom: string | null
  current: boolean
}) {
  const split = useSplitArticle()
  // Per package next to per-piece/kg prices of the other variants: say so.
  const per = a.basis === 'pack' && product.basis !== 'pack' ? '/förp' : perLabel(a.basis)
  const sizeText = a.sizeSource === 'weighed' ? 'säljs per kg' : a.size ? formatPackage(a.size) : 'storlek okänd'

  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-secondary/40">
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium truncate">{a.name}</span>
            {current && <span className="text-[10px] rounded-full bg-hb-green/15 text-hb-green px-1.5 py-px shrink-0">senast</span>}
          </span>
          <span className="block text-[11px] text-muted-foreground truncate">
            <span className={cn(!a.size && 'italic')}>{sizeText}</span> · {a.count} köp · senast {formatDate(a.lastDate, 'medium')}
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block font-serif text-[14px] font-medium">{formatPrice(a.avgPrice)}</span>
          <span className="block text-[10px] text-muted-foreground">snitt{per}</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 text-[12px]">
          <dl className="grid grid-cols-3 gap-2">
            <Fact label="Senaste" value={`${formatPrice(a.latestPrice)}${per}`} />
            <Fact label="Mot tidigare" value={a.priceChange == null ? '–' : formatChange(a.priceChange)} tone={a.priceChange} />
            <Fact label="Totalt" value={formatCurrency(a.total)} />
          </dl>

          <div className="text-muted-foreground space-y-0.5">
            {a.articleNumber && <div>Artikelnr {a.articleNumber}</div>}
            {a.names.length > 1 && <div>Har hetat: {a.names.join(' · ')}</div>}
            {replacedFrom && <div className="text-hb-amber">Ersatte {replacedFrom} {formatDate(a.firstDate, 'medium')}</div>}
            {a.sizeSource === 'name' && <div>Storleken är läst från namnet</div>}
          </div>

          {a.sizeSource !== 'weighed' && <SizeEditor article={a} />}

          <ul className="divide-y divide-border/50 border-t border-border/50">
            {[...a.purchases].reverse().map((p) => (
              <li key={p.lineId} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-muted-foreground">
                  {formatDate(p.date, 'medium')} · {p.store || 'Okänd butik'}
                  {purchaseLabel(p) && ` · ${purchaseLabel(p)}`}
                </span>
                <span className="text-right">
                  <span className="font-medium">{formatCurrency(p.total)}</span>
                  {(a.basis !== 'pack' || p.quantity !== 1) && (
                    <span className="block text-[10px] text-muted-foreground">
                      {formatPrice((a.basis === 'pack' ? p.packPrice : p.measurePrice) ?? 0)}{per}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {product.productId && product.articles.length > 1 && (
            <button
              type="button"
              disabled={split.isPending}
              onClick={() =>
                split.mutate({ productId: product.productId!, lineIds: a.lineIds, articleNumber: a.articleNumber, rawNames: a.rawNames })
              }
              className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive disabled:opacity-60"
            >
              <Scissors className="w-3.5 h-3.5" /> Inte samma vara — gör till egen vara
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function SizeEditor({ article }: { article: ArticleStat }) {
  const setSize = useSetArticleSize()
  const initial = article.size
    ? article.size.unit === 'kg' && article.size.size < 1
      ? { amount: String(Math.round(article.size.size * 1000)), unit: 'g' }
      : article.size.unit === 'l' && article.size.size < 1
        ? { amount: String(Math.round(article.size.size * 10 * 100) / 100), unit: 'dl' }
        : { amount: String(article.size.size), unit: article.size.unit }
    : { amount: '', unit: 'g' }
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(initial.amount)
  const [unit, setUnit] = useState(initial.unit)

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-hb-cognac-deep font-medium">
        {article.size ? 'Ändra förpackningsstorlek' : 'Ange förpackningsstorlek för jämförpris'}
      </button>
    )
  }

  const value = Number(amount.replace(',', '.'))
  const def = SIZE_UNITS.find((u) => u.value === unit)!
  const valid = value > 0 && value * def.factor <= 60

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        setSize.mutate(
          { lineIds: article.lineIds, size: { size: Math.round(value * def.factor * 10000) / 10000, unit: def.unit } },
          { onSuccess: () => setEditing(false) }
        )
      }}
    >
      <input
        autoFocus
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="500"
        aria-label="Mängd i förpackningen"
        className="w-20 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-hb-cognac"
      />
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        aria-label="Enhet"
        className="rounded-lg border border-border bg-card px-2 py-1.5 text-[13px]"
      >
        {SIZE_UNITS.map((u) => (
          <option key={u.value} value={u.value}>{u.label}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!valid || setSize.isPending}
        className="flex items-center gap-1 rounded-lg bg-hb-nav text-hb-nav-foreground px-2.5 py-1.5 text-[12px] disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" /> Spara
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground px-1">
        Avbryt
      </button>
    </form>
  )
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div className="bg-card rounded-xl px-2.5 py-2 min-w-0">
      <dt className="text-[10px] text-muted-foreground truncate">{label}</dt>
      <dd
        className={cn(
          'font-medium text-[13px] truncate',
          tone != null && tone > 0.02 && 'text-destructive',
          tone != null && tone < -0.02 && 'text-hb-green'
        )}
      >
        {value}
      </dd>
    </div>
  )
}
