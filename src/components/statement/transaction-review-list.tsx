'use client'

import { useState } from 'react'
import { useStatementTransactions, useUpdateTransactionCategory, useUpdateTransactionCostAssignment, useImportTransactions, type StatementTransactionWithCategory } from '@/hooks/use-statement-analyzer'
import { useCategories } from '@/hooks/use-categories'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency } from '@/lib/utils/formatters'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Loader2, Check, User, Users, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

const COST_ASSIGNMENT_OPTIONS = [
  { value: 'personal', label: 'Personlig', icon: User },
  { value: 'shared', label: 'Delad', icon: Users },
  { value: 'partner', label: 'Partner', icon: UserCheck },
] as const

interface Props {
  analysisId: string
}

export function TransactionReviewList({ analysisId }: Props) {
  const { data: user } = useUser()
  const { data: transactions, isLoading } = useStatementTransactions(analysisId)
  const { data: categories } = useCategories()
  const updateCategory = useUpdateTransactionCategory()
  const updateCostAssignment = useUpdateTransactionCostAssignment()
  const importTransactions = useImportTransactions()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
  }

  const pendingTransactions = transactions?.filter(t => !t.is_saved && t.is_expense) || []
  const savedTransactions = transactions?.filter(t => t.is_saved) || []

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  function selectAll() {
    const allWithCategory = pendingTransactions
      .filter(t => t.confirmed_category_id)
      .map(t => t.id)
    setSelectedIds(new Set(allWithCategory))
  }

  async function handleImport() {
    const toImport = pendingTransactions.filter(t => selectedIds.has(t.id)) as StatementTransactionWithCategory[]
    if (toImport.length === 0) {
      toast.error('Välj transaktioner att importera')
      return
    }

    const withoutCategory = toImport.filter(t => !t.confirmed_category_id)
    if (withoutCategory.length > 0) {
      toast.error('Alla valda transaktioner måste ha en kategori')
      return
    }

    try {
      await importTransactions.mutateAsync({
        transactions: toImport,
        userId: user!.id
      })
      toast.success(`${toImport.length} utgifter importerade!`)
      setSelectedIds(new Set())
    } catch (error) {
      toast.error('Kunde inte importera')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {pendingTransactions.length} transaktioner att granska
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Välj alla med kategori
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={selectedIds.size === 0 || importTransactions.isPending}
          >
            {importTransactions.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Importera ({selectedIds.size})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {pendingTransactions.map(transaction => {
            const costOption = COST_ASSIGNMENT_OPTIONS.find(
              o => o.value === (transaction.cost_assignment || 'shared')
            )
            const CostIcon = costOption?.icon || Users

            return (
              <div
                key={transaction.id}
                className={cn(
                  "p-4",
                  selectedIds.has(transaction.id) && "bg-hb-sage/10"
                )}
              >
                {/* Top row: checkbox, description, amount */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(transaction.id)}
                    onCheckedChange={() => toggleSelect(transaction.id)}
                    disabled={!transaction.confirmed_category_id}
                    className="mt-1"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-tight">{transaction.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{format(new Date(transaction.date), 'd MMM yyyy', { locale: sv })}</span>
                      {transaction.cardholder && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {transaction.cardholder.split(' ')[0]}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right font-semibold tabular-nums">
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>

                {/* Bottom row: cost assignment & category selects */}
                <div className="flex items-center gap-2 mt-3 ml-7">
                  <Select
                    value={transaction.cost_assignment || 'shared'}
                    onValueChange={(value: 'personal' | 'shared' | 'partner') => {
                      updateCostAssignment.mutate({
                        transactionId: transaction.id,
                        costAssignment: value
                      })
                    }}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue>
                        <span className="flex items-center gap-2">
                          <CostIcon className="w-3.5 h-3.5" />
                          {costOption?.label}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {COST_ASSIGNMENT_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <option.icon className="w-4 h-4" />
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={transaction.confirmed_category_id || ''}
                    onValueChange={(value) => {
                      updateCategory.mutate({
                        transactionId: transaction.id,
                        categoryId: value
                      })
                    }}
                  >
                    <SelectTrigger className="h-8 flex-1">
                      <SelectValue placeholder="Välj kategori..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {savedTransactions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Redan importerade ({savedTransactions.length})
          </h3>
          <Card className="opacity-60">
            <CardContent className="p-0 divide-y">
              {savedTransactions.slice(0, 5).map(t => (
                <div key={t.id} className="p-3 flex items-center gap-3">
                  <Check className="w-4 h-4 text-success" />
                  <span className="flex-1 truncate text-sm">{t.description}</span>
                  <span className="text-sm">{formatCurrency(t.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
