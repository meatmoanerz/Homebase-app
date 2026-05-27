'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  useRecurringExpenses,
  useDeleteRecurringExpense,
  useToggleRecurringExpense,
  useUpdateRecurringExpense,
  type RecurringExpenseWithCategory,
} from '@/hooks/use-recurring-expenses'
import { useCreateExpense } from '@/hooks/use-expenses'
import { useCategoriesByType } from '@/hooks/use-categories'
import { useUser, usePartner } from '@/hooks/use-user'
import { formatCurrency } from '@/lib/utils/formatters'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2,
  Users,
  UserCheck,
  Calendar,
  Power,
  CreditCard,
  PlayCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Category } from '@/types'

const categoryIcons: Record<string, string> = {
  Mat: '🛒',
  Hem: '🏠',
  Kläder: '👕',
  Nöje: '🎬',
  Restaurang: '🍽️',
  Transport: '🚗',
  Kollektivtrafik: '🚌',
  Resor: '✈️',
  El: '⚡',
  Prenumerationer: '📱',
  Netflix: '🎬',
  Spotify: '🎵',
}

export function RecurringExpensesList() {
  const { data: recurringExpenses = [], isLoading } = useRecurringExpenses()
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { fixed, variable, savings } = useCategoriesByType()
  const deleteRecurringExpense = useDeleteRecurringExpense()
  const toggleRecurringExpense = useToggleRecurringExpense()
  const updateRecurringExpense = useUpdateRecurringExpense()
  const createExpense = useCreateExpense()

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<RecurringExpenseWithCategory | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)

  // Edit form state
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editDayOfMonth, setEditDayOfMonth] = useState(1)
  const [editCostAssignment, setEditCostAssignment] = useState<'personal' | 'shared' | 'partner'>('shared')
  const [editIsCcm, setEditIsCcm] = useState(false)
  const [editIsActive, setEditIsActive] = useState(true)
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [dayPickerOpen, setDayPickerOpen] = useState(false)

  const allCategories = useMemo(() => [...variable, ...fixed, ...savings], [variable, fixed, savings])
  const hasPartner = !!partner
  const isCCMEnabled = user?.ccm_enabled || false

  const filteredCategories = useMemo(() => {
    if (!categorySearch) return { variable, fixed, savings }
    const search = categorySearch.toLowerCase()
    return {
      variable: variable.filter(c => c.name.toLowerCase().includes(search)),
      fixed: fixed.filter(c => c.name.toLowerCase().includes(search)),
      savings: savings.filter(c => c.name.toLowerCase().includes(search)),
    }
  }, [categorySearch, variable, fixed, savings])

  const selectedCategory = allCategories.find(c => c.id === editCategoryId)

  const handleDelete = async () => {
    if (!selectedExpense) return
    try {
      await deleteRecurringExpense.mutateAsync(selectedExpense.id)
      toast.success(`"${selectedExpense.description}" borttagen`)
      setDeleteDialogOpen(false)
      setEditDialogOpen(false)
      setSelectedExpense(null)
    } catch {
      toast.error('Kunde inte ta bort')
    }
  }

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      await toggleRecurringExpense.mutateAsync({ id, is_active: !currentState })
      toast.success(currentState ? 'Inaktiverad' : 'Aktiverad')
    } catch {
      toast.error('Kunde inte ändra status')
    }
  }

  const openEditDialog = (expense: RecurringExpenseWithCategory) => {
    setSelectedExpense(expense)
    setEditAmount(expense.amount.toString())
    setEditDescription(expense.description)
    setEditCategoryId(expense.category_id)
    setEditDayOfMonth(expense.day_of_month)
    setEditCostAssignment(expense.cost_assignment)
    setEditIsCcm(expense.is_ccm)
    setEditIsActive(expense.is_active)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedExpense) return
    try {
      await updateRecurringExpense.mutateAsync({
        id: selectedExpense.id,
        amount: parseInt(editAmount),
        description: editDescription,
        category_id: editCategoryId,
        day_of_month: editDayOfMonth,
        cost_assignment: editCostAssignment,
        is_ccm: editIsCcm,
        is_active: editIsActive,
      })
      toast.success('Uppdaterad!')
      setEditDialogOpen(false)
      setSelectedExpense(null)
    } catch {
      toast.error('Kunde inte uppdatera')
    }
  }

  const handleCategorySelect = (category: Category) => {
    setEditCategoryId(category.id)
    setCategorySearch('')
    setCategoryOpen(false)
  }

  const getDayDisplay = (day: number) => {
    if (day === 31) return 'Sista dagen'
    return `Den ${day}:e`
  }

  const handleRegisterAll = async () => {
    setIsRegistering(true)
    try {
      const now = new Date()
      const activeExpenses = recurringExpenses.filter((e) => e.is_active)

      if (activeExpenses.length === 0) {
        toast.info('Inga aktiva återkommande utgifter att registrera')
        setRegisterDialogOpen(false)
        return
      }

      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data: existingExpenses } = await supabase
        .from('expenses')
        .select('recurring_expense_id')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .eq('is_recurring', true)
        .not('recurring_expense_id', 'is', null)

      const existingIds = new Set(
        existingExpenses?.map((e: any) => e.recurring_expense_id).filter(Boolean) || []
      )

      const expensesToRegister = activeExpenses.filter((e) => !existingIds.has(e.id))

      if (expensesToRegister.length === 0) {
        toast.info('Alla återkommande utgifter är redan registrerade för denna månad')
        setRegisterDialogOpen(false)
        return
      }

      if (expensesToRegister.length < activeExpenses.length) {
        const alreadyRegistered = activeExpenses.length - expensesToRegister.length
        toast.info(
          `${alreadyRegistered} utgifter är redan registrerade. Registrerar ${expensesToRegister.length} nya.`
        )
      }

      const promises = expensesToRegister.map((recurring) => {
        let expenseDate: Date
        if (recurring.day_of_month === 31) {
          expenseDate = endOfMonth(now)
        } else {
          expenseDate = new Date(now.getFullYear(), now.getMonth(), recurring.day_of_month)
        }

        return createExpense.mutateAsync({
          category_id: recurring.category_id,
          description: recurring.description,
          amount: recurring.amount,
          date: format(expenseDate, 'yyyy-MM-dd'),
          cost_assignment: recurring.cost_assignment,
          assigned_to: recurring.assigned_to,
          is_ccm: recurring.is_ccm,
          is_recurring: true,
          recurring_expense_id: recurring.id,
        } as any)
      })

      await Promise.all(promises)
      toast.success(`${expensesToRegister.length} utgifter registrerade! 🎉`)
      setRegisterDialogOpen(false)
    } catch (error: any) {
      toast.error('Kunde inte registrera utgifter')
      console.error('Registration error:', error)
    } finally {
      setIsRegistering(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Laddar...</div>
      </div>
    )
  }

  if (recurringExpenses.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">Inga återkommande utgifter än</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Lägg till din första återkommande utgift
          </p>
        </CardContent>
      </Card>
    )
  }

  const activeExpenses = recurringExpenses.filter((e) => e.is_active)
  const totalAmount = recurringExpenses.reduce((sum, e) => sum + (e.is_active ? e.amount : 0), 0)

  const dayOptions = [...Array(28)].map((_, i) => i + 1).concat([31])
  const hasFilteredResults = filteredCategories.variable.length > 0 ||
    filteredCategories.fixed.length > 0 ||
    filteredCategories.savings.length > 0

  return (
    <>
      <div className="space-y-3">
        {/* Register All Button */}
        {activeExpenses.length > 0 && (
          <Card className="border-0 shadow-sm bg-hb-sage/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-hb-cognac/20 flex items-center justify-center">
                    <PlayCircle className="w-5 h-5 text-hb-cognac" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Registrera återkommande utgifter</p>
                    <p className="text-xs text-muted-foreground">
                      {activeExpenses.length} aktiva utgifter för denna månad
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setRegisterDialogOpen(true)}
                  className="bg-hb-cognac hover:bg-hb-cognac/90"
                >
                  Registrera alla
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recurring Expenses List */}
        <Card className="border-0 shadow-sm overflow-hidden">
          {/* Collapsible Header */}
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <div>
              <p className="font-medium text-sm">
                Återkommande utgifter ({recurringExpenses.length})
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalAmount)}/månad • {activeExpenses.length} aktiva
              </p>
            </div>
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            )}
          </div>

          {/* Expandable List */}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <CardContent className="p-0 border-t border-border">
                  {recurringExpenses.map((expense, index) => (
                    <motion.div
                      key={expense.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => openEditDialog(expense)}
                      className={cn(
                        'flex items-center justify-between p-4 hover:bg-muted/30 active:bg-muted/50 active:scale-[0.99] transition-all cursor-pointer',
                        index !== recurringExpenses.length - 1 && 'border-b border-border',
                        !expense.is_active && 'opacity-50'
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-hb-sage/20 flex items-center justify-center text-lg shrink-0">
                          {categoryIcons[expense.category?.name || ''] || '💰'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{expense.description}</p>
                            {!expense.is_active && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                                Inaktiv
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Cost assignment indicator */}
                        {expense.cost_assignment === 'shared' && (
                          <div
                            className="w-5 h-5 rounded-full bg-hb-tim/20 flex items-center justify-center"
                            title="Delad utgift"
                          >
                            <Users className="w-3 h-3 text-hb-tim" />
                          </div>
                        )}
                        {expense.cost_assignment === 'partner' && (
                          <div
                            className="w-5 h-5 rounded-full bg-hb-terracotta/20 flex items-center justify-center"
                            title="Partnerns utgift"
                          >
                            <UserCheck className="w-3 h-3 text-hb-terracotta" />
                          </div>
                        )}
                        <span
                          className={cn(
                            'font-semibold min-w-[70px] text-right',
                            expense.is_ccm ? 'text-hb-tim' : ''
                          )}
                        >
                          {formatCurrency(expense.amount)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleActive(expense.id, expense.is_active)
                          }}
                          className={cn(
                            'h-11 w-11 rounded-full flex items-center justify-center transition-all active:scale-95',
                            expense.is_active
                              ? 'bg-hb-cognac/20 text-hb-cognac shadow-[0_0_12px_rgba(108,119,84,0.4)] hover:shadow-[0_0_16px_rgba(108,119,84,0.6)]'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          )}
                          title={expense.is_active ? 'Inaktivera' : 'Aktivera'}
                        >
                          <Power className={cn('h-4 w-4', expense.is_active && 'drop-shadow-[0_0_2px_rgba(108,119,84,0.8)]')} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Redigera återkommande utgift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label>Belopp</Label>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-muted text-sm"
                style={{ outline: 'none' }}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Beskrivning</Label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-muted text-sm"
                style={{ outline: 'none' }}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Kategori</Label>
              <div className="relative">
                <div
                  className="w-full h-11 px-4 rounded-xl bg-muted text-sm flex items-center justify-between cursor-pointer"
                  onClick={() => setCategoryOpen(!categoryOpen)}
                >
                  <span>{selectedCategory?.name || 'Välj kategori'}</span>
                  <ChevronDown className="w-4 h-4" />
                </div>
                {categoryOpen && (
                  <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto">
                    {filteredCategories.fixed.length > 0 && (
                      <div>
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                          Fasta kostnader
                        </div>
                        {filteredCategories.fixed.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleCategorySelect(cat)}
                            className="w-full px-4 py-3 min-h-[44px] text-left hover:bg-muted/50 active:bg-muted flex items-center justify-between"
                          >
                            <span>{cat.name}</span>
                            {editCategoryId === cat.id && <Check className="w-4 h-4 text-hb-cognac" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {filteredCategories.variable.length > 0 && (
                      <div>
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                          Rörliga kostnader
                        </div>
                        {filteredCategories.variable.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleCategorySelect(cat)}
                            className="w-full px-4 py-3 min-h-[44px] text-left hover:bg-muted/50 active:bg-muted flex items-center justify-between"
                          >
                            <span>{cat.name}</span>
                            {editCategoryId === cat.id && <Check className="w-4 h-4 text-hb-cognac" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Day of Month */}
            <div className="space-y-2">
              <Label>Återkommer varje månad</Label>
              <div className="relative">
                <div
                  className="w-full h-11 px-4 rounded-xl bg-muted text-sm flex items-center justify-between cursor-pointer"
                  onClick={() => setDayPickerOpen(!dayPickerOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{getDayDisplay(editDayOfMonth)}</span>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </div>
                {dayPickerOpen && (
                  <div className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto p-2">
                    <div className="grid grid-cols-4 gap-1">
                      {dayOptions.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setEditDayOfMonth(day)
                            setDayPickerOpen(false)
                          }}
                          className={cn(
                            'py-2 px-3 text-sm rounded-lg transition-colors',
                            editDayOfMonth === day
                              ? 'bg-hb-cognac text-white font-medium'
                              : 'hover:bg-muted/50'
                          )}
                        >
                          {day === 31 ? 'Sista' : day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cost Assignment */}
            {hasPartner && (
              <div className="space-y-2">
                <Label>Vems utgift?</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditCostAssignment(editCostAssignment === 'personal' ? 'shared' : 'personal')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                      editCostAssignment === 'personal'
                        ? 'bg-hb-cognac text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {user?.first_name || 'Mig'}
                  </button>
                  <button
                    onClick={() => setEditCostAssignment(editCostAssignment === 'partner' ? 'shared' : 'partner')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                      editCostAssignment === 'partner'
                        ? 'bg-hb-cognac text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {partner?.first_name || 'Partner'}
                  </button>
                </div>
              </div>
            )}

            {/* CCM Toggle */}
            {isCCMEnabled && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-hb-sand-deep/20">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-hb-terracotta" />
                  <Label htmlFor="edit_is_ccm">Betald med kreditkort</Label>
                </div>
                <Switch
                  id="edit_is_ccm"
                  checked={editIsCcm}
                  onCheckedChange={setEditIsCcm}
                />
              </div>
            )}

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <Label htmlFor="edit_is_active">Aktiv</Label>
              <Switch
                id="edit_is_active"
                checked={editIsActive}
                onCheckedChange={setEditIsActive}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              className="mr-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Ta bort
            </Button>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSaveEdit} className="bg-hb-cognac hover:bg-hb-cognac/90">
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort återkommande utgift?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta tar bort den återkommande utgiften. Redan registrerade utgifter påverkas inte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Register All Confirmation Dialog */}
      <AlertDialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-hb-cognac" />
              Registrera återkommande utgifter?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Detta kommer att skapa {activeExpenses.length} utgifter för aktuell månad baserat på dina
              aktiva återkommande utgifter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegistering}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegisterAll}
              disabled={isRegistering}
              className="bg-hb-cognac hover:bg-hb-cognac/90"
            >
              {isRegistering ? 'Registrerar...' : 'Registrera alla'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
