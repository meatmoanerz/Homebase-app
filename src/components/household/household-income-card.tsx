'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'
import type { HouseholdModel, IncomeSplit } from '@/lib/household/economy'

interface HouseholdIncomeCardProps {
  model: HouseholdModel
  split: IncomeSplit
  userName: string
  partnerName: string
  monthLabel: string
  /** Names of the counted incomes, e.g. "Lön · Föräldrapenning" */
  incomeNames: string
}

/**
 * The income side of the period: the equalization under "Delad inkomst", the
 * percentage under "Efter inkomst", or who still has to register income.
 */
export function HouseholdIncomeCard({ model, split, userName, partnerName, monthLabel, incomeNames }: HouseholdIncomeCardProps) {
  if (model === 'budget') return null

  if (!split.bothRegistered) {
    const missing = [split.userCounted <= 0 && userName, split.partnerCounted <= 0 && partnerName].filter(Boolean) as string[]
    return (
      <Card className="border border-dashed border-hb-amber shadow-none">
        <CardContent className="p-5 space-y-3">
          <div className="w-11 h-11 rounded-full bg-hb-amber/15 text-hb-amber flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="font-serif text-xl font-semibold">
            Väntar på {missing.length === 2 ? 'era inkomster' : `${missing[0]}s inkomst`}
          </h2>
          <p className="text-muted-foreground leading-snug">
            {model === 'equal'
              ? `Utjämningen räknas ut när båda har lagt in sin inkomst för ${monthLabel}.`
              : `Procentsatsen räknas ut när båda har lagt in sin inkomst för ${monthLabel}. Till dess delas kostnaderna lika.`}
          </p>
          <Link
            href="/budget/income"
            className="flex items-center justify-center h-11 rounded-xl bg-hb-nav text-hb-nav-foreground font-semibold"
          >
            Lägg in inkomst
          </Link>
        </CardContent>
      </Card>
    )
  }

  const userPct = Math.round(split.userShare * 100)
  const counted = split.userCounted + split.partnerCounted

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold">
            {model === 'equal' ? 'Inkomstutjämning' : `Er procentsats i ${monthLabel}`}
          </h2>
          <span className="text-xs text-muted-foreground truncate">{incomeNames}</span>
        </div>

        <div className="relative h-7 rounded-lg overflow-hidden flex text-xs font-semibold text-white" aria-label={`${userName} ${userPct} %, ${partnerName} ${100 - userPct} %`}>
          <div className="bg-hb-tim flex items-center pl-2.5 whitespace-nowrap" style={{ width: `${split.userShare * 100}%` }}>
            {userName} {userPct} %
          </div>
          <div className="flex-1 bg-hb-amanda flex items-center justify-end pr-2.5 whitespace-nowrap">
            {100 - userPct} % {partnerName}
          </div>
          {model === 'equal' && <div className="absolute left-1/2 inset-y-0 w-0.5 bg-card" aria-hidden="true" />}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-hb-tim-soft px-3 py-2.5">
            <div className="text-xs text-muted-foreground">{userName} fick in</div>
            <div className="font-bold text-[17px] tabular-nums">{formatCurrency(split.userCounted)}</div>
          </div>
          <div className="rounded-xl bg-hb-amanda-soft px-3 py-2.5">
            <div className="text-xs text-muted-foreground">{partnerName} fick in</div>
            <div className="font-bold text-[17px] tabular-nums">{formatCurrency(split.partnerCounted)}</div>
          </div>
        </div>

        {model === 'equal' && (
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Totalt hushållet</span><span className="tabular-nums">{formatCurrency(counted)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Varsin hälft</span><span className="tabular-nums">{formatCurrency(Math.round(counted / 2))}</span></div>
            <div className="flex justify-between pt-2 border-t border-border font-semibold">
              <span>
                {split.equalization === 0
                  ? 'Ni tjänar lika — ingen swish'
                  : split.equalization > 0 ? `${userName} swishar ${partnerName}` : `${partnerName} swishar ${userName}`}
              </span>
              {split.equalization !== 0 && <span className="tabular-nums">{formatCurrency(Math.abs(split.equalization))}</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
