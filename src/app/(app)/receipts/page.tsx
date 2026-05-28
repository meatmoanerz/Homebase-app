'use client'

import { useState, useMemo } from 'react'
import { useReceipts, useProductSummary, useReceiptItems, usePriceHistory } from '@/hooks/use-receipts'
import { formatCurrency, formatRelativeDate } from '@/lib/utils/formatters'
import { motion, AnimatePresence } from 'framer-motion'
import { Receipt, Search, ChevronRight, X, Store, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function ReceiptsPage() {
  const { data: receipts = [], isLoading: receiptsLoading } = useReceipts()
  const { data: products = [], isLoading: productsLoading } = useProductSummary()

  const [productSearch, setProductSearch] = useState('')
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null)
  const [openProductId, setOpenProductId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const count = receipts.length
    const total = receipts.reduce((s, r) => s + r.total_amount, 0)
    const avg = count > 0 ? total / count : 0
    return { count, total, avg }
  }, [receipts])

  const filteredProducts = products.filter((p) =>
    p.product_name?.toLowerCase().includes(productSearch.toLowerCase())
  )

  const isEmpty = !receiptsLoading && receipts.length === 0 && products.length === 0

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-5">
      {/* Desktop title */}
      <div className="hidden md:block">
        <h1 className="font-serif text-[32px] font-medium tracking-tight">Kvitton</h1>
        <p className="text-sm text-muted-foreground mt-1">Inköp och prisanalys</p>
      </div>

      {isEmpty ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 md:p-12 text-center shadow-sm"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-hb-cognac/10 grid place-items-center mb-5">
            <Receipt className="w-7 h-7 text-hb-cognac" />
          </div>
          <h2 className="font-serif text-xl font-medium mb-2">Inga kvitton ännu</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Ladda upp kvitton från ICA, Hemköp och andra butiker så börjar appen
            spåra priser över tid. Be Claude i chatten att läsa av ett kvittofoto
            och spara raderna åt dig.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
                Kvitton
              </div>
              <div className="font-serif text-[26px] font-medium tracking-tight mt-1.5">
                {stats.count} st
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">totalt</div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
                Snitt/kvitto
              </div>
              <div className="font-serif text-[26px] font-medium tracking-tight mt-1.5">
                {formatCurrency(stats.avg)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">per inköp</div>
            </div>
          </div>

          <div className="md:grid md:grid-cols-2 md:gap-5 space-y-5 md:space-y-0">
            {/* Receipts list */}
            <section>
              <h2 className="font-serif text-[20px] font-medium tracking-tight pb-3">
                Senaste kvitton
              </h2>
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {receipts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Inga kvitton
                  </div>
                ) : (
                  receipts.map((r) => (
                    <div key={r.id}>
                      <button
                        onClick={() => setOpenReceiptId(openReceiptId === r.id ? null : r.id)}
                        className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-secondary grid place-items-center flex-shrink-0">
                            <Store className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm tracking-tight truncate">
                              {r.store?.name || r.store?.chain || 'Okänd butik'}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatRelativeDate(r.purchase_date)} · {r.item_count} varor
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-serif text-[16px] font-medium tracking-tight">
                            {formatCurrency(r.total_amount)}
                          </span>
                          <ChevronRight className={cn('w-4 h-4 text-muted-foreground/60 transition-transform', openReceiptId === r.id && 'rotate-90')} />
                        </div>
                      </button>
                      <AnimatePresence>
                        {openReceiptId === r.id && (
                          <ReceiptItemsDrawer receiptId={r.id} />
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Price analysis */}
            <section>
              <h2 className="font-serif text-[20px] font-medium tracking-tight pb-3">
                Prisanalys
              </h2>

              <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3.5 py-2.5 mb-3">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Sök produkt…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>

              {productsLoading ? (
                <div className="text-sm text-muted-foreground px-1">Laddar…</div>
              ) : filteredProducts.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
                  Inga produkter spårade ännu
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredProducts.map((p) => (
                    <ProductCard
                      key={p.product_id}
                      product={p}
                      isOpen={openProductId === p.product_id}
                      onToggle={() => setOpenProductId(openProductId === p.product_id ? null : p.product_id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function ReceiptItemsDrawer({ receiptId }: { receiptId: string }) {
  const { data: items = [], isLoading } = useReceiptItems(receiptId)

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-secondary/30 border-b border-border overflow-hidden"
    >
      <div className="px-4 py-2">
        {isLoading ? (
          <div className="text-xs text-muted-foreground py-2">Laddar varor…</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1.5 text-[13px]">
              <span className={cn('truncate', item.needs_review && 'text-hb-amber')}>
                {item.raw_name}
                {item.quantity > 1 && <span className="text-muted-foreground"> ×{item.quantity}</span>}
              </span>
              <span className="font-medium ml-2 flex-shrink-0">{formatCurrency(item.total_price)}</span>
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}

function ProductCard({
  product,
  isOpen,
  onToggle,
}: {
  product: import('@/hooks/use-receipts').ProductSummary
  isOpen: boolean
  onToggle: () => void
}) {
  const { data: history = [] } = usePriceHistory(isOpen ? product.product_id : null)

  // Trend: compare latest to average
  const trend = product.avg_unit_price > 0
    ? ((product.max_unit_price - product.min_unit_price) / product.avg_unit_price)
    : 0

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <button onClick={onToggle} className="w-full px-4 py-3.5 text-left hover:bg-secondary/40 transition-colors">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[16px] font-medium tracking-tight">{product.product_name}</span>
          <span className="text-[11px] text-muted-foreground">{product.purchase_count} köp</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[12px] text-muted-foreground">
            Snitt {formatCurrency(product.avg_unit_price)}
          </span>
          <span className="text-[12px] text-success font-medium">
            Lägst {formatCurrency(product.min_unit_price)}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && history.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border bg-secondary/30 overflow-hidden"
          >
            <div className="px-4 py-3">
              <PriceSparkline history={history} />
              <div className="mt-3 space-y-1">
                {history.slice(-5).reverse().map((point, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">
                      {formatRelativeDate(point.purchase_date)} · {point.store_chain || point.store_name || '–'}
                    </span>
                    <span className="font-medium">{formatCurrency(point.effective_unit_price)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PriceSparkline({ history }: { history: import('@/hooks/use-receipts').PriceHistoryPoint[] }) {
  if (history.length < 2) {
    return <div className="text-[11px] text-muted-foreground">Behöver fler köp för graf</div>
  }

  const prices = history.map((h) => h.effective_unit_price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const W = 200, H = 36

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W
    const y = H - ((p - min) / range) * H
    return `${x},${y}`
  }).join(' ')

  const rising = prices[prices.length - 1] > prices[0]
  const color = rising ? 'var(--hb-terracotta)' : 'var(--hb-olive)'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-9">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={W} cy={H - ((prices[prices.length - 1] - min) / range) * H} r="3" fill={color} />
    </svg>
  )
}
