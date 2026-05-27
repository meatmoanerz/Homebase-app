'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useSavingsGoal, useSavingsGoalContributions } from '@/hooks/use-savings-goals'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/formatters'
import { format, differenceInDays, differenceInMonths } from 'date-fns'
import { sv } from 'date-fns/locale'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Target,
  Calendar,
  TrendingUp,
  Users,
  PiggyBank,
  Receipt,
  User,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { GoalCategory } from '@/types'

const goalCategoryIcons: Record<GoalCategory, string> = {
  emergency: '🛡️',
  vacation: '✈️',
  home: '🏠',
  car: '🚗',
  education: '📚',
  retirement: '👴',
  other: '🎯',
}

const goalCategoryLabels: Record<GoalCategory, string> = {
  emergency: 'Buffert',
  vacation: 'Semester',
  home: 'Boende',
  car: 'Bil',
  education: 'Utbildning',
  retirement: 'Pension',
  other: 'Övrigt',
}

export default function SavingsGoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: goal, isLoading: goalLoading } = useSavingsGoal(id)
  const { data: contributions = [], isLoading: contributionsLoading } = useSavingsGoalContributions(id)

  if (goalLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4" />
          <div className="h-32 bg-muted rounded mb-4" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="p-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Target className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Sparmålet hittades inte</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/savings')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tillbaka till sparmål
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate total saved - for shared goals, use user amounts; for personal goals, use starting_balance
  const totalSaved = goal.is_shared
    ? goal.starting_balance_user1 + goal.starting_balance_user2
    : goal.starting_balance
  const targetAmount = goal.target_amount || 0
  const progress = targetAmount > 0 ? Math.min((totalSaved / targetAmount) * 100, 100) : 0
  const remaining = Math.max(targetAmount - totalSaved, 0)

  // Calculate time remaining
  const targetDate = goal.target_date ? new Date(goal.target_date) : null
  const daysRemaining = targetDate ? differenceInDays(targetDate, new Date()) : null
  const monthsRemaining = targetDate ? differenceInMonths(targetDate, new Date()) : null

  // Calculate monthly savings needed
  const monthlySavingsNeeded =
    monthsRemaining && monthsRemaining > 0 ? remaining / monthsRemaining : remaining

  // Get icon for the goal type
  const goalIcon = goal.custom_goal_type?.icon || goalCategoryIcons[goal.goal_category]
  const goalTypeLabel = goal.custom_goal_type?.name || goalCategoryLabels[goal.goal_category]

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/savings')}
          className="shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{goalIcon}</span>
            <h1 className="text-xl font-bold text-hb-cognac">{goal.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{goalTypeLabel}</p>
        </div>
      </motion.div>

      {/* Progress Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-hb-sage/30 to-hb-cognac/20 p-6">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground mb-1">Sparat</p>
              <p className="text-4xl font-bold text-hb-cognac">{formatCurrency(totalSaved)}</p>
              {targetAmount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  av {formatCurrency(targetAmount)}
                </p>
              )}
            </div>

            {/* Progress bar */}
            {targetAmount > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{progress.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-white/50 dark:bg-card/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-hb-cognac rounded-full"
                  />
                </div>
              </div>
            )}
          </div>

          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Remaining */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-hb-sand-deep/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-hb-terracotta" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Kvar att spara</p>
                  <p className="font-semibold">{formatCurrency(remaining)}</p>
                </div>
              </div>

              {/* Time remaining */}
              {targetDate && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-hb-tim/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-hb-tim" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tid kvar</p>
                    <p className="font-semibold">
                      {daysRemaining && daysRemaining > 0
                        ? daysRemaining > 30
                          ? `${monthsRemaining} mån`
                          : `${daysRemaining} dagar`
                        : 'Förfallet'}
                    </p>
                  </div>
                </div>
              )}

              {/* Monthly savings */}
              {goal.monthly_savings_enabled && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-hb-sage/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-hb-cognac" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Månadssparande</p>
                    <p className="font-semibold">{formatCurrency(goal.monthly_savings_amount)}/mån</p>
                  </div>
                </div>
              )}

              {/* Monthly needed */}
              {monthsRemaining && monthsRemaining > 0 && remaining > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <PiggyBank className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Behövs/mån</p>
                    <p className="font-semibold">{formatCurrency(monthlySavingsNeeded)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* User Contributions (if shared) */}
      {goal.is_shared && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Bidrag per person
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-hb-sage/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-hb-cognac text-white flex items-center justify-center text-sm font-medium">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="font-medium">Du</span>
                </div>
                <span className="font-semibold">{formatCurrency(goal.starting_balance_user1)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-hb-sand-deep/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-hb-terracotta text-white flex items-center justify-center text-sm font-medium">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="font-medium">Partner</span>
                </div>
                <span className="font-semibold">{formatCurrency(goal.starting_balance_user2)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Contribution History */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Inbetalningshistorik
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contributionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-2/3" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : contributions.length === 0 ? (
              <div className="py-8 text-center">
                <Receipt className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground text-sm">Inga inbetalningar ännu</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Lägg till en utgift i kategorin &quot;{goal.name}&quot; för att se den här
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contributions.map((contribution, index) => (
                  <motion.div
                    key={contribution.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      index % 2 === 0 ? "bg-muted/50" : "bg-transparent"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {contribution.expense?.description || 'Inbetalning'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(contribution.created_at), 'd MMM yyyy', { locale: sv })}
                        {goal.is_shared && contribution.user1_amount > 0 && contribution.user2_amount > 0 && (
                          <span className="text-muted-foreground">
                            • Du: {formatCurrency(contribution.user1_amount)} | Partner: {formatCurrency(contribution.user2_amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-green-600 shrink-0">
                      +{formatCurrency(contribution.amount)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Goal Info */}
      {goal.description && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Beskrivning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{goal.description}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Target Date */}
      {targetDate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Måldatum</p>
                  <p className="font-medium">
                    {format(targetDate, 'd MMMM yyyy', { locale: sv })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
