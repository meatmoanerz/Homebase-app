'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Loader2, Share } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/formatters'
import { drawSummaryImage, shareImage, type SummaryImageInput } from '@/lib/household/share-image'
import type { SharedAccountSummary } from '@/lib/household/shared-account'

interface HouseholdSummaryCardProps {
  summary: SharedAccountSummary
  transfers: { label: string; amount: number }[]
  userName: string
  partnerName: string
  hasPartner: boolean
  /** Title and subtitle of the shared image, e.g. "November 2026 · Delad inkomst" */
  imageSubtitle: string
  fileName: string
}

/**
 * Sammanställning: what to transfer, every category it covers and the total,
 * so you can see the shared account covers all shared costs. One button
 * expands the per-person split for every row; Dela sends the collapsed
 * summary as an image.
 */
export function HouseholdSummaryCard({
  summary,
  transfers,
  userName,
  partnerName,
  hasPartner,
  imageSubtitle,
  fileName,
}: HouseholdSummaryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [sharing, setSharing] = useState(false)
  const imageRef = useRef<Blob | null>(null)

  const imageInput: SummaryImageInput = {
    title: 'Gemensam ekonomi',
    subtitle: imageSubtitle,
    transfers,
    rows: summary.rows.filter((r) => r.amount > 0).map((r) => ({ name: r.name, amount: r.amount })),
    total: summary.total,
    footer: `Skapad ${new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  }
  const imageKey = JSON.stringify({ ...imageInput, footer: '' })

  // Draw ahead of time: iOS only opens the share sheet straight from a tap
  useEffect(() => {
    let cancelled = false
    imageRef.current = null
    const input: SummaryImageInput = JSON.parse(imageKey)
    input.footer = `Skapad ${new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })}`
    drawSummaryImage(input)
      .then((blob) => { if (!cancelled) imageRef.current = blob })
      .catch((error) => console.error('Could not draw summary image:', error))
    return () => { cancelled = true }
  }, [imageKey])

  const handleShare = async () => {
    setSharing(true)
    try {
      const blob = imageRef.current ?? await drawSummaryImage(imageInput)
      await shareImage(blob, fileName, 'Gemensam ekonomi')
    } catch (error) {
      console.error('Share failed:', error)
      toast.error('Kunde inte dela bilden')
    } finally {
      setSharing(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold">Sammanställning</h2>
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing || summary.rows.length === 0}
            aria-label="Dela sammanställningen som bild"
            className="h-11 px-3 rounded-xl bg-muted font-semibold text-[13px] flex items-center gap-1.5 disabled:opacity-60"
          >
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share className="w-4 h-4" />}
            Dela
          </button>
        </div>

        {transfers.length > 0 && (
          <div className="rounded-xl bg-hb-sand px-3 py-2.5 space-y-1.5 text-[13px]">
            {transfers.map((t) => (
              <div key={t.label} className="flex justify-between gap-3">
                <span>{t.label}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(t.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {summary.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Inga gemensamma kostnader valda.{' '}
            <Link href="/settings/shared-costs" className="font-semibold underline">Välj kategorier</Link>
          </p>
        ) : (
          <div>
            {expanded && hasPartner && (
              <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_72px] gap-1 text-[11px] text-muted-foreground pb-1.5">
                <span>Kategori</span>
                <span className="text-right truncate">{userName}</span>
                <span className="text-right truncate">{partnerName}</span>
                <span className="text-right">Totalt</span>
              </div>
            )}
            {summary.rows.map((row) =>
              expanded && hasPartner ? (
                <div
                  key={row.categoryId}
                  className="grid grid-cols-[minmax(0,1fr)_64px_64px_72px] gap-1 items-center min-h-9 border-t border-border text-[13px] tabular-nums"
                >
                  <span className="truncate">
                    {row.name}
                    {row.byIncome && <span className="sr-only"> (efter inkomst)</span>}
                  </span>
                  <span className="text-right">{row.user.toLocaleString('sv-SE')}</span>
                  <span className="text-right">{row.partner.toLocaleString('sv-SE')}</span>
                  <span className="text-right font-semibold">{row.amount.toLocaleString('sv-SE')}</span>
                </div>
              ) : (
                <div key={row.categoryId} className="flex justify-between items-center min-h-9 border-t border-border text-[13px]">
                  <span className={cn('truncate', row.amount === 0 && 'text-muted-foreground')}>
                    {row.name}
                    {row.amount === 0 && ' · ej budgeterad'}
                  </span>
                  <span className="tabular-nums">{formatCurrency(row.amount)}</span>
                </div>
              )
            )}
            <div className="flex justify-between items-center min-h-11 border-t-2 border-border font-bold">
              <span>Totalt till gemensamt konto</span>
              <span className="tabular-nums">{formatCurrency(summary.total)}</span>
            </div>
            {hasPartner && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="w-full min-h-11 border-t border-border text-hb-cognac-deep font-semibold flex items-center justify-center gap-1.5"
              >
                {expanded ? 'Dölj fördelning per person' : 'Visa fördelning per person'}
                <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Fördelningen per rad kommer från budgeten och ändras där.{' '}
          <Link href="/settings/shared-costs" className="font-semibold underline">Ändra kategorier</Link>
        </p>
      </CardContent>
    </Card>
  )
}
