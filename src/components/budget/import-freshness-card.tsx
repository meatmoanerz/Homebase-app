'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { sv } from 'date-fns/locale'
import { AlertTriangle, Upload, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useImportFreshness } from '@/hooks/use-import-freshness'
import { useIsClient } from '@/hooks/use-is-client'
import { findStaleBanks } from '@/lib/import/freshness'

interface ImportFreshnessCardProps {
  /** The budget being created; dismissing hides the card for this period */
  period: string
  userId?: string
  userName: string
  partnerName?: string
}

const dismissKey = (period: string) => `import-freshness-dismissed-${period}`

function readDismissed(period: string): boolean {
  try {
    return localStorage.getItem(dismissKey(period)) === '1'
  } catch {
    return false
  }
}

/**
 * Before a new budget: banks whose files don't reach yesterday, for both of
 * you. Last period's actuals (and the card/account suggestion) come from those
 * transactions, so a missing file makes them look smaller than they were.
 */
export function ImportFreshnessCard({ period, userId, userName, partnerName }: ImportFreshnessCardProps) {
  const isClient = useIsClient()
  const { data: rows = [] } = useImportFreshness(!!userId)
  const [dismissedFor, setDismissedFor] = useState<Record<string, boolean>>({})

  const stale = useMemo(() => (isClient ? findStaleBanks(rows, new Date()) : []), [rows, isClient])
  const dismissed = dismissedFor[period] ?? (isClient && readDismissed(period))

  if (!isClient || dismissed || stale.length === 0) return null

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(period), '1')
    } catch {
      // Private mode: hidden until the page is reloaded
    }
    setDismissedFor((prev) => ({ ...prev, [period]: true }))
  }

  const ownerLabel = (id: string) => (id === userId ? userName : partnerName ?? 'Partner')
  const banks = Array.from(new Set(stale.map((s) => s.bank)))

  return (
    <Card className="border-0 shadow-sm bg-amber-500/10 border-l-4 border-l-amber-500">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Ladda upp senaste transaktionerna</p>
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {stale.map((s) => (
                <li key={`${s.userId}-${s.bank}`} className="flex flex-wrap gap-x-1.5">
                  <span className="font-medium">{partnerName ? `${ownerLabel(s.userId)} · ${s.bank}` : s.bank}</span>
                  <span className="text-muted-foreground">
                    t.o.m. {format(parseISO(s.coveredThrough), 'd MMM', { locale: sv })}, saknar från {format(parseISO(s.missingFrom), 'd MMM', { locale: sv })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-1.5">
              Förra periodens utfall bygger på transaktionerna. Ladda upp från {banks.join(', ')} först, annars ser utfallet mindre ut än det var.
            </p>
            <Link
              href="/import"
              className="inline-flex items-center gap-1.5 mt-2.5 min-h-9 text-sm font-semibold text-amber-800 dark:text-amber-300"
            >
              <Upload className="w-4 h-4" />
              Till import
            </Link>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dölj påminnelsen"
            className="w-9 h-9 -mr-2 -mt-2 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
