'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPeriodDisplay } from '@/lib/utils/budget-period'

interface ReportHeaderProps {
  period: string
  onPrev: () => void
  onNext: () => void
  isCurrentPeriod: boolean
}

export function ReportHeader({ period, onPrev, onNext, isCurrentPeriod }: ReportHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="icon" onClick={onPrev}>
        <ChevronLeft className="w-5 h-5" />
      </Button>
      <div className="text-center">
        <h1 className="text-xl font-bold text-hb-cognac capitalize">
          {formatPeriodDisplay(period)}
        </h1>
        <p className="text-xs text-muted-foreground">
          {isCurrentPeriod ? 'Pågående period' : 'Avslutad period'}
        </p>
      </div>
      <Button variant="ghost" size="icon" onClick={onNext} disabled={isCurrentPeriod}>
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  )
}
