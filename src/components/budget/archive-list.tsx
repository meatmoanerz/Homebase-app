'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useArchivedTemporaryBudgets,
  useArchivedMonthlyBudgets,
  useRestoreTemporaryBudget,
  useRestoreMonthlyBudget,
} from '@/hooks/use-temporary-budgets'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { formatPeriodDisplay } from '@/lib/utils/budget-period'
import { motion } from 'framer-motion'
import { ArrowLeft, RotateCcw, Wallet, FolderOpen, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

type ArchiveTab = 'monthly' | 'project'

export function ArchiveList() {
  const router = useRouter()
  const [tab, setTab] = useState<ArchiveTab>('monthly')

  const { data: archivedMonthly, isLoading: monthlyLoading } = useArchivedMonthlyBudgets()
  const { data: archivedProjects, isLoading: projectsLoading } = useArchivedTemporaryBudgets()
  const restoreMonthly = useRestoreMonthlyBudget()
  const restoreProject = useRestoreTemporaryBudget()

  async function handleRestoreMonthly(id: string) {
    try {
      await restoreMonthly.mutateAsync(id)
      toast.success('Budget återställd')
    } catch {
      toast.error('Kunde inte återställa budget')
    }
  }

  async function handleRestoreProject(id: string) {
    try {
      await restoreProject.mutateAsync(id)
      toast.success('Projektbudget återställd')
    } catch {
      toast.error('Kunde inte återställa projektbudget')
    }
  }

  const isLoading = monthlyLoading || projectsLoading

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-hb-cognac">Arkiv</h1>
      </motion.div>

      {/* Tab selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex justify-center"
      >
        <div className="inline-flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setTab('monthly')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-all',
              tab === 'monthly'
                ? 'bg-white dark:bg-card text-hb-cognac shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Wallet className="w-3.5 h-3.5" />
            Månadsbudgetar
          </button>
          <button
            onClick={() => setTab('project')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-all',
              tab === 'project'
                ? 'bg-white dark:bg-card text-hb-cognac shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Projekt
          </button>
        </div>
      </motion.div>

      {/* Content */}
      {tab === 'monthly' && (
        <div className="space-y-3">
          {!archivedMonthly || archivedMonthly.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Inga arkiverade månadsbudgetar</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            archivedMonthly.map((budget, index) => (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold capitalize">
                          {formatPeriodDisplay(budget.period)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Inkomst: {formatCurrency(budget.total_income)} | Utgifter:{' '}
                          {formatCurrency(budget.total_expenses)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestoreMonthly(budget.id)}
                        disabled={restoreMonthly.isPending}
                        className="text-muted-foreground hover:text-hb-cognac"
                      >
                        <RotateCcw className="w-4 h-4 mr-1.5" />
                        Återställ
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === 'project' && (
        <div className="space-y-3">
          {!archivedProjects || archivedProjects.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Inga arkiverade projektbudgetar</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            archivedProjects.map((budget, index) => (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-0 shadow-sm border-l-4 border-l-hb-sand/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{budget.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {formatDate(budget.start_date)} — {formatDate(budget.end_date)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(budget.total_spent)} / {formatCurrency(budget.total_budget)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestoreProject(budget.id)}
                        disabled={restoreProject.isPending}
                        className="text-muted-foreground hover:text-hb-cognac shrink-0"
                      >
                        <RotateCcw className="w-4 h-4 mr-1.5" />
                        Återställ
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
