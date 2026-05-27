'use client'

import { useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStatementTransactions, useUpdateTransactionCategory, useUpdateTransactionCostAssignment, useUpdateTransactionAmount, useUpdateTransactionDescription, useUpdateAnalysisInvoiceTotal, useImportTransactions, useBulkUpdateTransactionCategories, type StatementTransactionWithCategory } from '@/hooks/use-statement-analyzer'
import { useStatementAnalysis } from '@/hooks/use-statement-analyzer'
import { useCategories } from '@/hooks/use-categories'
import { useUser, usePartner } from '@/hooks/use-user'
import { useExpensesByDateRange } from '@/hooks/use-expenses-by-date-range'
import { findDuplicates, type DuplicateMatch } from '@/lib/utils/duplicate-matcher'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency } from '@/lib/utils/formatters'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Loader2, Check, ArrowLeft, FileText, AlertCircle, CheckCircle2, Pencil, Link, ChevronDown, ChevronUp, X, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

type CostAssignment = 'personal' | 'shared' | 'partner'

export default function ReviewPage() {
  const params = useParams()
  const router = useRouter()
  const analysisId = params.id as string

  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: analysis } = useStatementAnalysis(analysisId)
  const { data: transactions, isLoading } = useStatementTransactions(analysisId)
  const { data: categories } = useCategories()
  const updateCategory = useUpdateTransactionCategory()
  const updateCostAssignment = useUpdateTransactionCostAssignment()
  const updateAmount = useUpdateTransactionAmount()
  const updateDescription = useUpdateTransactionDescription()
  const updateInvoiceTotal = useUpdateAnalysisInvoiceTotal()
  const importTransactions = useImportTransactions()
  const bulkUpdateCategories = useBulkUpdateTransactionCategories()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingInvoiceTotal, setEditingInvoiceTotal] = useState(false)
  const [invoiceTotalInput, setInvoiceTotalInput] = useState('')
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [dismissedMatches, setDismissedMatches] = useState<Set<string>>(new Set())
  const [handledMatches, setHandledMatches] = useState<Map<string, string>>(new Map())
  const hasPartner = !!partner

  // Filter pending transactions (not saved — show all including returns)
  const pendingTransactions = useMemo(() =>
    transactions?.filter(t => !t.is_saved) || [],
    [transactions]
  )

  // Compute min/max dates from transactions for duplicate detection
  const dateRange = useMemo(() => {
    if (pendingTransactions.length === 0) return { minDate: null, maxDate: null }
    const dates = pendingTransactions.map(t => t.date)
    dates.sort()
    return { minDate: dates[0], maxDate: dates[dates.length - 1] }
  }, [pendingTransactions])

  // Fetch existing expenses in the transaction date range
  const { data: existingExpenses } = useExpensesByDateRange(dateRange.minDate, dateRange.maxDate)

  // Find duplicates
  const duplicateMap = useMemo(() => {
    if (!existingExpenses || existingExpenses.length === 0) return new Map<string, DuplicateMatch[]>()
    return findDuplicates(pendingTransactions, existingExpenses)
  }, [pendingTransactions, existingExpenses])

  // Unresolved duplicates (not dismissed AND not handled)
  const unresolvedDuplicates = useMemo(() => {
    const unresolved = new Map<string, DuplicateMatch[]>()
    for (const [txId, matches] of duplicateMap) {
      if (!dismissedMatches.has(txId) && !handledMatches.has(txId)) {
        unresolved.set(txId, matches)
      }
    }
    return unresolved
  }, [duplicateMap, dismissedMatches, handledMatches])

  const duplicateCount = unresolvedDuplicates.size + handledMatches.size

  // Calculate totals
  const calculatedTotal = useMemo(() =>
    pendingTransactions.reduce((sum, t) => sum + t.amount, 0),
    [pendingTransactions]
  )

  const selectedTotal = useMemo(() =>
    pendingTransactions
      .filter(t => selectedIds.has(t.id))
      .reduce((sum, t) => sum + t.amount, 0),
    [pendingTransactions, selectedIds]
  )

  // Check if all selected transactions have categories
  const allSelectedHaveCategories = useMemo(() => {
    if (selectedIds.size === 0) return false
    return pendingTransactions
      .filter(t => selectedIds.has(t.id))
      .every(t => t.confirmed_category_id !== null)
  }, [pendingTransactions, selectedIds])

  // Count selected transactions without category
  const selectedWithoutCategory = useMemo(() => {
    return pendingTransactions
      .filter(t => selectedIds.has(t.id) && !t.confirmed_category_id)
      .length
  }, [pendingTransactions, selectedIds])

  const invoiceTotal = analysis?.invoice_total || 0
  const totalDiff = Math.abs(invoiceTotal - calculatedTotal)
  const totalsMatch = totalDiff < 1 // Within 1 kr tolerance

  function isSelectable(t: StatementTransactionWithCategory) {
    // Handled matches are not selectable
    if (handledMatches.has(t.id)) return false
    // Unresolved matches must be confirmed/dismissed first
    if (unresolvedDuplicates.has(t.id)) return false
    return true
  }

  function toggleSelect(id: string) {
    const tx = pendingTransactions.find(t => t.id === id)
    if (!tx || !isSelectable(tx)) return

    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  function selectAll() {
    // Skip handled matches, unresolved matches
    const allIds = pendingTransactions
      .filter(t => isSelectable(t))
      .map(t => t.id)
    setSelectedIds(new Set(allIds))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  function dismissMatch(transactionId: string) {
    setDismissedMatches(prev => {
      const next = new Set(prev)
      next.add(transactionId)
      return next
    })
  }

  const confirmMatch = useCallback((transactionId: string, expenseId: string) => {
    const matches = duplicateMap.get(transactionId)
    const match = matches?.find(m => m.expense.id === expenseId)
    if (!match) return

    // Add to handled
    setHandledMatches(prev => {
      const next = new Map(prev)
      next.set(transactionId, expenseId)
      return next
    })

    // Remove from selected if previously selected
    setSelectedIds(prev => {
      if (!prev.has(transactionId)) return prev
      const next = new Set(prev)
      next.delete(transactionId)
      return next
    })

    // Inherit category from matched expense
    if (match.expense.category_id) {
      updateCategory.mutate({
        transactionId,
        categoryId: match.expense.category_id
      })
    }

    // Inherit cost assignment from matched expense
    if (match.expense.cost_assignment) {
      updateCostAssignment.mutate({
        transactionId,
        costAssignment: match.expense.cost_assignment as CostAssignment
      })
    }
  }, [duplicateMap, updateCategory, updateCostAssignment])

  function undoHandledMatch(transactionId: string) {
    setHandledMatches(prev => {
      const next = new Map(prev)
      next.delete(transactionId)
      return next
    })
  }

  async function handleBulkAssign() {
    if (!bulkCategoryId || selectedIds.size === 0) return

    try {
      await bulkUpdateCategories.mutateAsync({
        transactionIds: Array.from(selectedIds),
        categoryId: bulkCategoryId
      })
      toast.success(`Kategori tilldelad till ${selectedIds.size} transaktioner`)
      setBulkCategoryId('')
    } catch {
      toast.error('Kunde inte tilldela kategori')
    }
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

      // Navigate back to expenses list
      router.push('/expenses/list')
    } catch {
      toast.error('Kunde inte importera')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-hb-cognac" />
      </div>
    )
  }

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
          onClick={() => router.push('/statement-analyzer')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-hb-cognac">
            Granska transaktioner
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {analysis?.file_name}
          </p>
        </div>
      </motion.div>

      {/* Summary Card — only show for invoices (Amex etc.), not bank statements */}
      {analysis?.invoice_total != null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className={cn(
            "border-2",
            totalsMatch ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                {totalsMatch ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-warning" />
                )}
                <span className="font-medium">
                  {totalsMatch ? 'Beloppen stämmer' : 'Kontrollera beloppen'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    Fakturatotal
                    <button
                      type="button"
                      onClick={() => {
                        setEditingInvoiceTotal(true)
                        setInvoiceTotalInput(invoiceTotal.toString())
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </p>
                  {editingInvoiceTotal ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={invoiceTotalInput}
                        onChange={(e) => setInvoiceTotalInput(e.target.value)}
                        className="w-24 h-8 px-2 text-base font-semibold rounded border bg-background"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const newTotal = parseFloat(invoiceTotalInput)
                            if (!isNaN(newTotal) && newTotal >= 0) {
                              updateInvoiceTotal.mutate({ analysisId, invoiceTotal: newTotal })
                            }
                            setEditingInvoiceTotal(false)
                          } else if (e.key === 'Escape') {
                            setEditingInvoiceTotal(false)
                          }
                        }}
                        onBlur={() => {
                          const newTotal = parseFloat(invoiceTotalInput)
                          if (!isNaN(newTotal) && newTotal >= 0) {
                            updateInvoiceTotal.mutate({ analysisId, invoiceTotal: newTotal })
                          }
                          setEditingInvoiceTotal(false)
                        }}
                      />
                      <span className="text-base font-semibold">kr</span>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold">{formatCurrency(invoiceTotal)}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Summa transaktioner</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculatedTotal)}</p>
                </div>
              </div>
              {!totalsMatch && (
                <p className="text-xs text-warning mt-2">
                  Differens: {formatCurrency(totalDiff)}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {pendingTransactions.length} transaktioner
          {duplicateCount > 0 && (
            <span className="text-amber-600"> ({duplicateCount} troliga dubletter)</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Välj alla
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Avmarkera
            </Button>
          )}
        </div>
      </div>

      {/* Transaction List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-0 divide-y">
            {pendingTransactions.map((transaction, index) => {
              const handledExpenseId = handledMatches.get(transaction.id)
              const handledExpense = handledExpenseId
                ? duplicateMap.get(transaction.id)?.find(m => m.expense.id === handledExpenseId)?.expense
                : null

              return (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  categories={categories || []}
                  isSelected={selectedIds.has(transaction.id)}
                  isSelectable={isSelectable(transaction)}
                  onToggleSelect={() => toggleSelect(transaction.id)}
                  onUpdateCategory={(categoryId) => {
                    updateCategory.mutate({
                      transactionId: transaction.id,
                      categoryId
                    })
                  }}
                  onUpdateCostAssignment={(costAssignment) => {
                    updateCostAssignment.mutate({
                      transactionId: transaction.id,
                      costAssignment
                    })
                  }}
                  onUpdateAmount={(amount) => {
                    updateAmount.mutate({
                      transactionId: transaction.id,
                      amount
                    })
                  }}
                  onUpdateDescription={(description) => {
                    updateDescription.mutate({
                      transactionId: transaction.id,
                      description
                    })
                  }}
                  index={index}
                  userName={user?.first_name || 'Mig'}
                  partnerName={partner?.first_name || 'Partner'}
                  hasPartner={hasPartner}
                  duplicateMatches={unresolvedDuplicates.get(transaction.id) || null}
                  onDismissMatch={() => dismissMatch(transaction.id)}
                  onConfirmMatch={(expenseId) => confirmMatch(transaction.id, expenseId)}
                  handledExpense={handledExpense || null}
                  onUndoHandled={() => undoHandledMatch(transaction.id)}
                />
              )
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* Fixed bottom bar with bulk panel */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-20 left-0 right-0 bg-background border-t shadow-lg z-10"
        >
          <div className="max-w-lg mx-auto p-4 space-y-3">
            {/* Row 1: Selection info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{selectedIds.size} valda</p>
                <p className="text-xs text-muted-foreground">
                  Summa: {formatCurrency(selectedTotal)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Avmarkera alla
              </Button>
            </div>

            {/* Row 2: Bulk category assignment */}
            <div className="flex items-center gap-2">
              <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                <SelectTrigger className="flex-1">
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
              <Button
                variant="outline"
                onClick={handleBulkAssign}
                disabled={!bulkCategoryId || bulkUpdateCategories.isPending}
              >
                {bulkUpdateCategories.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Tilldela"
                )}
              </Button>
            </div>

            {/* Row 3: Save button */}
            <Button
              onClick={handleImport}
              disabled={!allSelectedHaveCategories || importTransactions.isPending}
              className="w-full bg-hb-cognac hover:bg-hb-cognac/90"
            >
              {importTransactions.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Spara som utgifter
              {selectedWithoutCategory > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  ({selectedWithoutCategory} saknar kategori)
                </span>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

interface TransactionRowProps {
  transaction: StatementTransactionWithCategory
  categories: { id: string; name: string }[]
  isSelected: boolean
  isSelectable: boolean
  onToggleSelect: () => void
  onUpdateCategory: (categoryId: string) => void
  onUpdateCostAssignment: (costAssignment: CostAssignment) => void
  onUpdateAmount: (amount: number) => void
  onUpdateDescription: (description: string) => void
  index: number
  userName: string
  partnerName: string
  hasPartner: boolean
  duplicateMatches: DuplicateMatch[] | null
  onDismissMatch: () => void
  onConfirmMatch: (expenseId: string) => void
  handledExpense: { id: string; description: string | null; amount: number; date: string } | null
  onUndoHandled: () => void
}

function TransactionRow({
  transaction,
  categories,
  isSelected,
  isSelectable: selectable,
  onToggleSelect,
  onUpdateCategory,
  onUpdateCostAssignment,
  onUpdateAmount,
  onUpdateDescription,
  index,
  userName,
  partnerName,
  hasPartner,
  duplicateMatches,
  onDismissMatch,
  onConfirmMatch,
  handledExpense,
  onUndoHandled
}: TransactionRowProps) {
  const costAssignment = transaction.cost_assignment || 'shared'
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionInput, setDescriptionInput] = useState('')
  const [showAllMatches, setShowAllMatches] = useState(false)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const hasUnresolvedMatch = !!duplicateMatches && duplicateMatches.length > 0
  const isHandled = !!handledExpense
  const isReturn = transaction.amount < 0

  const handleRowClick = () => {
    if (selectable) {
      onToggleSelect()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={handleRowClick}
      className={cn(
        "p-3 transition-colors",
        selectable && "cursor-pointer",
        isHandled && "border-l-2 border-l-emerald-500 bg-emerald-50/50",
        hasUnresolvedMatch && !isHandled && "border-l-2 border-l-amber-400 bg-amber-50/50",
        isReturn && !isHandled && !hasUnresolvedMatch && "bg-emerald-50/30",
        !isHandled && !hasUnresolvedMatch && !isReturn && isSelected && "bg-hb-sage/10"
      )}
    >
      {/* Row 1: Checkbox, Description, Amount */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          disabled={!selectable}
          className={cn("mt-1", !selectable && "opacity-50")}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {editingDescription ? (
              <input
                type="text"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                className="flex-1 h-7 px-2 text-sm font-medium rounded border bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = descriptionInput.trim()
                    if (trimmed && trimmed !== transaction.description) {
                      onUpdateDescription(trimmed)
                    }
                    setEditingDescription(false)
                  } else if (e.key === 'Escape') {
                    setEditingDescription(false)
                  }
                }}
                onBlur={() => {
                  const trimmed = descriptionInput.trim()
                  if (trimmed && trimmed !== transaction.description) {
                    onUpdateDescription(trimmed)
                  }
                  setEditingDescription(false)
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingDescription(true)
                  setDescriptionInput(transaction.description || '')
                }}
                className={cn(
                  "font-medium leading-tight text-left group flex items-center gap-1",
                  (isHandled || hasUnresolvedMatch) && "text-muted-foreground"
                )}
              >
                {transaction.description}
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0" />
              </button>
            )}
            {isReturn && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0">
                Retur
              </span>
            )}
          </div>
        </div>
        {/* Editable Amount */}
        <div onClick={(e) => e.stopPropagation()}>
          {editingAmount ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-20 h-7 px-2 text-sm font-semibold tabular-nums rounded border bg-background text-right"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const newAmount = parseFloat(amountInput)
                    if (!isNaN(newAmount)) {
                      onUpdateAmount(newAmount)
                    }
                    setEditingAmount(false)
                  } else if (e.key === 'Escape') {
                    setEditingAmount(false)
                  }
                }}
                onBlur={() => {
                  const newAmount = parseFloat(amountInput)
                  if (!isNaN(newAmount)) {
                    onUpdateAmount(newAmount)
                  }
                  setEditingAmount(false)
                }}
              />
              <span className="text-sm">kr</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingAmount(true)
                setAmountInput(transaction.amount.toString())
              }}
              className={cn(
                "font-semibold tabular-nums whitespace-nowrap flex items-center gap-1 group",
                isReturn ? "text-emerald-600" : "",
                (isHandled || hasUnresolvedMatch) ? "text-muted-foreground" : "hover:text-hb-cognac"
              )}
            >
              {formatCurrency(transaction.amount)}
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Date + cost assignment + category */}
      <div className="flex items-center gap-2 mt-1.5 ml-7" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-muted-foreground shrink-0">
          {format(new Date(transaction.date), 'd MMM', { locale: sv })}
        </span>

        {/* Cost Assignment buttons */}
        {hasPartner && (
          <>
            <span className="text-xs text-muted-foreground">·</span>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onUpdateCostAssignment(costAssignment === 'personal' ? 'shared' : 'personal')}
                className={cn(
                  "py-0.5 px-2 rounded text-[11px] font-medium transition-all",
                  costAssignment === 'personal'
                    ? "bg-hb-cognac text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {userName}
              </button>
              <button
                type="button"
                onClick={() => onUpdateCostAssignment(costAssignment === 'partner' ? 'shared' : 'partner')}
                className={cn(
                  "py-0.5 px-2 rounded text-[11px] font-medium transition-all",
                  costAssignment === 'partner'
                    ? "bg-hb-cognac text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {partnerName}
              </button>
            </div>
          </>
        )}

        {/* Category Dropdown */}
        <Select
          value={transaction.confirmed_category_id || ''}
          onValueChange={onUpdateCategory}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue placeholder="Välj kategori..." />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Handled match indicator */}
      {isHandled && (
        <div className="ml-7 mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700 truncate">
              Hanterad — matchad med &ldquo;{handledExpense.description}&rdquo;
            </p>
          </div>
          <button
            type="button"
            onClick={onUndoHandled}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 shrink-0"
          >
            <Undo2 className="w-3 h-3" />
            Ångra
          </button>
        </div>
      )}

      {/* Unresolved duplicate match panel */}
      {hasUnresolvedMatch && !isHandled && (
        <div className="ml-7 mt-2 rounded-lg border border-amber-300/50 bg-amber-50/50 p-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-2">
            <Link className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-700">Trolig dubblett</p>

              {duplicateMatches!.length === 1 ? (
                // Single match — inline
                <>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    &ldquo;{duplicateMatches![0].expense.description}&rdquo; — {formatCurrency(duplicateMatches![0].expense.amount)}, {format(new Date(duplicateMatches![0].expense.date), 'd MMM', { locale: sv })}
                  </p>
                  <div className="flex gap-2 mt-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onConfirmMatch(duplicateMatches![0].expense.id)}
                      className="h-6 text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Hanterad
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDismissMatch}
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Inte samma
                    </Button>
                  </div>
                </>
              ) : (
                // Multiple matches — radio list
                <>
                  <div className="mt-1 space-y-1">
                    {(showAllMatches ? duplicateMatches! : duplicateMatches!.slice(0, 1)).map((match) => (
                      <label
                        key={match.expense.id}
                        className={cn(
                          "flex items-center gap-2 text-xs text-muted-foreground p-1 rounded cursor-pointer hover:bg-amber-100/50",
                          selectedMatchId === match.expense.id && "bg-amber-100/80"
                        )}
                      >
                        <input
                          type="radio"
                          name={`match-${transaction.id}`}
                          checked={selectedMatchId === match.expense.id}
                          onChange={() => setSelectedMatchId(match.expense.id)}
                          className="w-3 h-3 accent-amber-600"
                        />
                        <span className="truncate">
                          &ldquo;{match.expense.description}&rdquo; — {formatCurrency(match.expense.amount)}, {format(new Date(match.expense.date), 'd MMM', { locale: sv })}
                        </span>
                      </label>
                    ))}
                  </div>

                  {duplicateMatches!.length > 1 && !showAllMatches && (
                    <button
                      type="button"
                      onClick={() => setShowAllMatches(true)}
                      className="text-[11px] text-amber-600 hover:underline mt-1 flex items-center gap-0.5"
                    >
                      +{duplicateMatches!.length - 1} {duplicateMatches!.length - 1 === 1 ? 'möjlig matchning' : 'möjliga matchningar'}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  )}
                  {showAllMatches && duplicateMatches!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllMatches(false)}
                      className="text-[11px] text-amber-600 hover:underline mt-1 flex items-center gap-0.5"
                    >
                      Visa färre
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  )}

                  <div className="flex gap-2 mt-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const matchId = selectedMatchId || duplicateMatches![0].expense.id
                        onConfirmMatch(matchId)
                      }}
                      className="h-6 text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Hanterad
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDismissMatch}
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Inte samma
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
