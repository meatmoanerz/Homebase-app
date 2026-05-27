'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface PeriodStripProps {
  /** Display label like "Maj" or "April 2026" */
  label: string
  /** Period date range like "25 apr – 24 maj" */
  range?: string
  /** Called when user presses left arrow */
  onPrevious?: () => void
  /** Called when user presses right arrow */
  onNext?: () => void
  /** Disable buttons */
  disabledPrevious?: boolean
  disabledNext?: boolean
  className?: string
}

export function PeriodStrip({
  label,
  range,
  onPrevious,
  onNext,
  disabledPrevious,
  disabledNext,
  className,
}: PeriodStripProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between md:justify-start md:gap-2',
        className
      )}
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={disabledPrevious}
        aria-label="Föregående period"
        className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-[18px] h-[18px]" />
      </button>

      <div className="text-center md:text-left">
        <div className="font-serif text-[17px] font-medium tracking-tight">{label}</div>
        {range && (
          <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground mt-0.5">
            {range}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={disabledNext}
        aria-label="Nästa period"
        className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-[18px] h-[18px]" />
      </button>
    </div>
  )
}
