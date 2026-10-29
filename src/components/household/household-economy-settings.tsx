'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HouseholdModelPicker } from '@/components/household/household-model-picker'
import { useUser, usePartner } from '@/hooks/use-user'
import { useBudgetByPeriod } from '@/hooks/use-budgets'
import { useHouseholdEconomy, useSaveHouseholdSettings } from '@/hooks/use-household-economy'
import { computeIncomeSplit, type HouseholdModel } from '@/lib/household/economy'
import { computeSharedAccountSummary } from '@/lib/household/shared-account'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatPeriodDisplay, getCurrentBudgetPeriod, getNextPeriods } from '@/lib/utils/budget-period'

function monthName(period: string): string {
  const name = formatPeriodDisplay(period).split(' ')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** "Så delar ni ekonomin" — the household model, its start period and which incomes count. */
export function HouseholdEconomySettings() {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay).period
  const periods = getNextPeriods(salaryDay, 4)
  const [period, setPeriod] = useState(currentPeriod)

  const { settings, incomes, incomeSplit, isLoading } = useHouseholdEconomy(period)
  const { data: budget } = useBudgetByPeriod(period)
  const save = useSaveHouseholdSettings()

  const userName = user?.first_name || 'Du'
  const partnerName = partner?.first_name || 'Partner'
  const month = monthName(period)

  const examples = useMemo((): Record<HouseholdModel, string> => {
    const shared = computeSharedAccountSummary(budget?.budget_items ?? [], settings.categoryIds, user?.id, partner?.id)
    const equal = computeIncomeSplit(incomes, user?.id, partner?.id, { ...settings, model: 'equal' })
    const waiting = 'Räknas när ni båda lagt in inkomst'
    const userPct = Math.round(incomeSplit.userShare * 100)

    let equalExample = waiting
    if (equal.bothRegistered) {
      if (equal.equalization > 0) equalExample = `${month}: ${userName} swishar ${partnerName} ${formatCurrency(equal.equalization)}`
      else if (equal.equalization < 0) equalExample = `${month}: ${partnerName} swishar ${userName} ${formatCurrency(-equal.equalization)}`
      else equalExample = `${month}: ni tjänar lika, ingen swish`
    }

    return {
      budget: shared.rows.length > 0
        ? `${month}: ${userName} ${formatCurrency(shared.user)} · ${partnerName} ${formatCurrency(shared.partner)}`
        : 'Varje kostnad delas som i budgeten',
      income: incomeSplit.bothRegistered
        ? `${month}: ${userName} ${userPct} % · ${partnerName} ${100 - userPct} %`
        : waiting,
      equal: equalExample,
    }
  }, [budget, settings, incomes, incomeSplit, user?.id, partner?.id, month, userName, partnerName])

  // Income names to toggle: those registered this period plus any excluded earlier
  const incomeNames = useMemo(() => {
    const names = new Set(incomes.map((i) => i.name))
    settings.excludedIncomeNames.forEach((n) => names.add(n))
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'sv'))
  }, [incomes, settings.excludedIncomeNames])

  const incomeHint = (name: string) => {
    const parts = incomes
      .filter((i) => i.name === name)
      .map((i) => `${i.user_id === user?.id ? userName : partnerName} ${formatCurrency(i.amount)}`)
    return parts.length > 0 ? parts.join(' · ') : `Ingen registrerad i ${month.toLowerCase()}`
  }

  const toggleIncome = (name: string, counts: boolean) => {
    const excluded = new Set(settings.excludedIncomeNames)
    if (counts) excluded.delete(name)
    else excluded.add(name)
    save.mutate({ period, current: settings, excludedIncomeNames: Array.from(excluded), successMessage: false })
  }

  const sinceNote = settings.effectiveFrom && settings.effectiveFrom !== period
    ? `Gäller sedan ${formatPeriodDisplay(settings.effectiveFrom)}`
    : settings.effectiveFrom ? null : 'Inget valt ännu'

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-semibold">Så delar ni ekonomin</h2>
            <p className="text-[13px] text-muted-foreground">Gäller hela hushållet. Ni ser samma val.</p>
          </div>

          <HouseholdModelPicker
            value={settings.model}
            examples={examples}
            disabled={isLoading || save.isPending}
            onChange={(model) => {
              if (model === settings.model) return
              save.mutate({ period, current: settings, model, successMessage: `Sparat — gäller från ${formatPeriodDisplay(period)}` })
            }}
          />

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
            <div>
              <p className="text-[13px] text-muted-foreground">Gäller från</p>
              {sinceNote && <p className="text-xs text-muted-foreground/80">{sinceNote}</p>}
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-auto min-w-40 h-11 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.period} value={p.period}>
                    <span className="capitalize">{formatPeriodDisplay(p.period)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {settings.model !== 'budget' && incomeNames.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-serif text-lg font-semibold">
              {settings.model === 'equal' ? 'Inkomster som delas lika' : 'Inkomster som räknas in'}
            </h2>
            <p className="text-[13px] text-muted-foreground mb-2">Slå av det som ska vara privat, till exempel en bonus.</p>
            {incomeNames.map((name) => {
              const counts = !settings.excludedIncomeNames.has(name)
              const id = `income-${name}`
              return (
                <label key={name} htmlFor={id} className="flex items-center gap-3 min-h-13 border-t border-border cursor-pointer">
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium">{name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{incomeHint(name)}</span>
                  </span>
                  <Switch id={id} checked={counts} onCheckedChange={(on) => toggleIncome(name, on)} disabled={save.isPending} />
                </label>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Link
        href="/settings/shared-costs"
        className="flex items-center gap-3 p-4 rounded-xl bg-card shadow-sm hover:bg-muted/40 transition-colors"
      >
        <span className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Wallet className="w-4 h-4 text-hb-cognac-deep" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium">Gemensamma kostnader</span>
          <span className="block text-xs text-muted-foreground">
            {settings.categoryIds.size} kategorier
            {settings.model === 'income' && ` · ${settings.incomeCategoryIds.size} efter inkomst`}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>
    </div>
  )
}
