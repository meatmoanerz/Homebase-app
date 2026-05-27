'use client'

import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ReportHeroCardProps {
  totalIncome: number
  totalSpent: number
}

export function ReportHeroCard({ totalIncome, totalSpent }: ReportHeroCardProps) {
  const netBalance = totalIncome - totalSpent
  const isPositive = netBalance > 0
  const isNeutral = netBalance === 0

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-hb-cognac to-hb-cognac/85 text-white">
      <CardContent className="p-5">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wide">Inkomst</p>
            <p className="text-lg font-bold">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60 uppercase tracking-wide">Utgifter</p>
            <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
          </div>
        </div>
        <div className="border-t border-white/20 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/70">Nettoresultat</p>
            <div className="flex items-center gap-2">
              {isNeutral ? (
                <Minus className="w-4 h-4 text-white/60" />
              ) : isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-300" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-300" />
              )}
              <p className={cn(
                'text-xl font-bold',
                isPositive && 'text-green-300',
                !isPositive && !isNeutral && 'text-red-300'
              )}>
                {isPositive ? '+' : ''}{formatCurrency(netBalance)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
