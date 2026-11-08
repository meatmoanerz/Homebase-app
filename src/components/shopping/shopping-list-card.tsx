'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/** A list on the shopping page: own list or Veckomat, with check progress. */
export function ShoppingListCard({
  href,
  name,
  subtitle,
  items,
  muted = false,
}: {
  href: string
  name: string
  subtitle: string
  items: { checked: boolean }[]
  muted?: boolean
}) {
  const total = items.length
  const done = items.filter((i) => i.checked).length

  return (
    <Link
      href={href}
      className={cn(
        'block bg-card border border-border rounded-3xl p-4 shadow-sm hover:border-hb-cognac/50 transition-colors',
        muted && 'bg-card/60 shadow-none'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-[18px] font-medium tracking-tight truncate">{name}</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        </div>
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/60" />
      </div>
      {total > 0 && (
        <div className="mt-3">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-hb-cognac transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {done === total ? 'Allt handlat' : `${done} av ${total} i korgen`}
          </div>
        </div>
      )}
    </Link>
  )
}
