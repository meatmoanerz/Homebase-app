'use client'

import { Link2, Link2Off } from 'lucide-react'
import { BottomSheet } from '@/components/shared/bottom-sheet'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { displayName, productGroup, quantityLabel, type ExpenseLike, type ReceiptHead, type ReceiptLine } from '@/lib/receipts/receipt-analytics'
import { cn } from '@/lib/utils/cn'

interface ReceiptSheetProps {
  receipt: ReceiptHead | null
  lines: ReceiptLine[]
  matchedExpense: ExpenseLike | null
  onOpenChange: (open: boolean) => void
  onSelectProduct: (line: ReceiptLine) => void
}

/** One receipt, printed: the lines, a breakdown per product group, savings and deposit. */
export function ReceiptSheet({ receipt, lines, matchedExpense, onOpenChange, onSelectProduct }: ReceiptSheetProps) {
  const items = lines.filter((l) => !l.is_deposit && !/^pant\b/i.test(l.raw_name))
  const deposit = lines.filter((l) => l.is_deposit || /^pant\b/i.test(l.raw_name)).reduce((s, l) => s + Number(l.total_price), 0)
  const discount = lines.reduce((s, l) => s + Number(l.discount_amount || 0), 0)

  const groups = new Map<string, { label: string; total: number }>()
  for (const l of items) {
    const g = productGroup(displayName(l))
    const cur = groups.get(g.key) ?? { label: g.label, total: 0 }
    cur.total += Number(l.total_price)
    groups.set(g.key, cur)
  }
  const groupList = [...groups.values()].sort((a, b) => b.total - a.total)
  const itemsTotal = groupList.reduce((s, g) => s + g.total, 0)

  return (
    <BottomSheet
      open={!!receipt}
      onOpenChange={onOpenChange}
      title={receipt?.store?.name || receipt?.store?.chain || 'Kvitto'}
      subtitle={receipt ? `${formatDate(receipt.purchase_date, 'long')} · ${items.length} varor` : undefined}
    >
      {receipt && (
        <div className="space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="label-caps text-muted-foreground">Totalt</div>
              <div className="font-serif-hero text-[34px] leading-none mt-1">{formatCurrency(Number(receipt.total_amount))}</div>
            </div>
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                matchedExpense ? 'bg-hb-green/15 text-hb-green' : 'bg-secondary text-muted-foreground'
              )}
              title={matchedExpense ? `${matchedExpense.description} · ${formatDate(matchedExpense.date, 'short')}` : undefined}
            >
              {matchedExpense ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
              {matchedExpense ? 'Matchad mot utgift' : 'Ingen utgift hittad'}
            </div>
          </div>

          {groupList.length > 0 && itemsTotal > 0 && (
            <div>
              <div className="flex h-2 rounded-full overflow-hidden gap-[2px]">
                {groupList.map((g, i) => (
                  <div
                    key={g.label}
                    className="h-full bg-chart-spend"
                    style={{ width: `${(g.total / itemsTotal) * 100}%`, opacity: Math.max(0.25, 1 - i * 0.14) }}
                    title={`${g.label} ${formatCurrency(g.total)}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                {groupList.map((g, i) => (
                  <span key={g.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-chart-spend" style={{ opacity: Math.max(0.25, 1 - i * 0.14) }} />
                    {g.label} {Math.round((g.total / itemsTotal) * 100)} %
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-secondary/30 px-4 py-3 font-mono text-[12.5px]">
            {[...items].sort((a, b) => Number(b.total_price) - Number(a.total_price)).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onSelectProduct(l)}
                className="w-full flex items-baseline justify-between gap-3 py-1 text-left hover:text-hb-cognac-deep"
              >
                <span className="truncate">
                  {displayName(l)}
                  {quantityLabel(l.quantity, l.product?.unit) && (
                    <span className="text-muted-foreground"> {quantityLabel(l.quantity, l.product?.unit)}</span>
                  )}
                </span>
                <span className="shrink-0">{formatCurrency(Number(l.total_price))}</span>
              </button>
            ))}
            {(discount > 0 || deposit !== 0) && <div className="border-t border-dashed border-border my-2" />}
            {discount > 0 && (
              <div className="flex justify-between text-hb-green">
                <span>Rabatter</span>
                <span>−{formatCurrency(discount)}</span>
              </div>
            )}
            {deposit !== 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Pant</span>
                <span>{formatCurrency(deposit)}</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Tryck på en vara för att se dess prisutveckling.</p>
        </div>
      )}
    </BottomSheet>
  )
}
