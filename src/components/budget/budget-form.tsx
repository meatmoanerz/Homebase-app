'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
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
import { useCategoriesByType } from '@/hooks/use-categories'
import { useHouseholdIncomeDetails } from '@/hooks/use-incomes'
import { useHouseholdMonthlyIncomes } from '@/hooks/use-monthly-incomes'
import { useCreateBudget, useUpdateBudget, useDeleteBudget, usePreviousBudget, useBudgetByPeriod } from '@/hooks/use-budgets'
import { useUser, usePartner } from '@/hooks/use-user'
import { useLoans } from '@/hooks/use-loans'
import { useCCMInvoice } from '@/hooks/use-ccm-invoices'
import { useCCMExpenses, groupExpensesByInvoicePeriod } from '@/hooks/use-expenses'
import { calculatePaymentSplit } from '@/lib/utils/ccm-split'
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters'
import { formatPeriodDisplay, getCurrentBudgetPeriod, getNextPeriods } from '@/lib/utils/budget-period'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  PiggyBank,
  TrendingDown,
  Wallet,
  Users,
  Check,
  User,
  History,
  Copy,
  ExternalLink,
  Lock,
  CreditCard,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import type { BudgetWithItems, Category, BudgetItem, BudgetItemWithCategory } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface BudgetFormProps {
  existingBudget?: BudgetWithItems
  defaultPeriod?: string
}

// Budget item with optional per-partner split
interface BudgetItemState {
  total: number
  userAmount?: number
  partnerAmount?: number
  isSplit: boolean
  hasExplicitSplit: boolean // True only when user has explicitly set different amounts in split view
  is_ccm: boolean // Whether this is a CCM (credit card) expense
}

// Income state for editable amounts
interface IncomeState {
  id: string
  name: string
  amount: number
  isUser: boolean
}

export function BudgetForm({ existingBudget, defaultPeriod }: BudgetFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: householdData, isLoading: incomesLoading } = useHouseholdIncomeDetails()
  const { fixed, variable, savings, isLoading: categoriesLoading } = useCategoriesByType()
  const { data: loans } = useLoans()

  // Get monthly incomes for the selected period (preferred over static incomes)
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()

  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)
  const availablePeriods = getNextPeriods(salaryDay, 6)

  // State
  const [period, setPeriod] = useState(existingBudget?.period || defaultPeriod || currentPeriod.period)
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)
  const [periodChanged, setPeriodChanged] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    income: true,
    fixed: true,
    variable: true,
    savings: true,
  })
  const [budgetItems, setBudgetItems] = useState<Record<string, BudgetItemState>>({})
  const [incomes, setIncomes] = useState<IncomeState[]>([])
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [incomesInitialized, setIncomesInitialized] = useState(false)
  
  // Previous budget states
  const [showPreviousValues, setShowPreviousValues] = useState(false)
  const [showCopyConfirm, setShowCopyConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { data: previousBudget, isLoading: previousBudgetLoading } = usePreviousBudget(period)

  // Monthly incomes for the selected period (preferred over static incomes)
  const { data: monthlyIncomes, isLoading: monthlyIncomesLoading } = useHouseholdMonthlyIncomes(period)

  // CCM invoice and expenses for auto-filling "Kreditkort" budget item with split
  const { data: ccmInvoice } = useCCMInvoice(period)
  const invoiceBreakDate = user?.ccm_invoice_break_date || 1
  const { data: ccmExpenses = [] } = useCCMExpenses(invoiceBreakDate)
  
  // Check if selected period already has a saved budget (only relevant in /new)
  const { data: existingPeriodBudget, isLoading: checkingExistingBudget } = useBudgetByPeriod(
    !existingBudget ? period : '' // Only check if we're creating new, not editing
  )
  const periodAlreadyHasBudget = !existingBudget && !!existingPeriodBudget
  
  // Draft saving
  const [draftLoaded, setDraftLoaded] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')
  
  // Build a map of category_name -> previous amount for quick lookup
  // We use category name instead of ID because partners may have different category IDs
  const previousAmounts = useMemo(() => {
    if (!previousBudget?.budget_items) return {}

    const map: Record<string, number> = {}
    previousBudget.budget_items.forEach(item => {
      if (item.category?.name) {
        map[item.category.name] = item.amount
      }
    })
    return map
  }, [previousBudget])

  // Calculate loan totals for auto-filling budget
  const loanTotals = useMemo(() => {
    if (!loans || loans.length === 0) return { totalInterest: 0, totalAmortization: 0 }

    const totalInterest = loans.reduce((sum, loan) => {
      return sum + Math.round(loan.current_balance * (loan.interest_rate / 100 / 12))
    }, 0)

    const totalAmortization = loans.reduce((sum, loan) => {
      return sum + loan.monthly_amortization
    }, 0)

    return { totalInterest, totalAmortization }
  }, [loans])

  // Helper: Map budget items from partner's category IDs to current user's category IDs by matching names
  const mapBudgetItemsToCurrentCategories = useCallback((
    items: BudgetItemWithCategory[] | undefined,
    categories: Category[]
  ): Record<string, BudgetItemState> => {
    if (!items) return {}

    const map: Record<string, BudgetItemState> = {}

    items.forEach(item => {
      if (!item.category?.name) return

      // Find matching category in current user's categories by name
      const matchingCategory = categories.find(c => c.name === item.category?.name)
      if (matchingCategory) {
        map[matchingCategory.id] = {
          total: item.amount,
          isSplit: false,
          hasExplicitSplit: false,
          is_ccm: item.is_ccm || false
        }
      }
    })

    return map
  }, [])
  
  // Draft storage key
  const getDraftKey = useCallback((p: string) => `budget-draft-${p}`, [])
  
  // Save draft function (silent, no toast)
  const saveDraft = useCallback(() => {
    if (existingBudget || !initialized || !draftLoaded) return false
    
    try {
      const draftKey = getDraftKey(period)
      const draft = { 
        budgetItems, 
        incomes: incomes.map(inc => ({ id: inc.id, amount: inc.amount })),
        savedAt: new Date().toISOString() 
      }
      localStorage.setItem(draftKey, JSON.stringify(draft))
      lastSavedRef.current = JSON.stringify({ budgetItems, incomes: incomes.map(inc => ({ id: inc.id, amount: inc.amount })) })
      return true
    } catch (e) {
      console.error('Failed to save draft:', e)
      return false
    }
  }, [budgetItems, incomes, period, existingBudget, initialized, draftLoaded, getDraftKey])
  
  // Auto-save draft to localStorage (debounced, silent)
  useEffect(() => {
    // Don't auto-save during period transitions or if not properly initialized
    if (existingBudget || !initialized || !draftLoaded || periodChanged) return
    
    // Create a string representation to compare
    const currentState = JSON.stringify({ budgetItems, incomes: incomes.map(inc => ({ id: inc.id, amount: inc.amount })) })
    
    // Don't save if nothing has changed
    if (currentState === lastSavedRef.current) return
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Debounce save by 2 seconds (silent - no toast)
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft()
    }, 2000)
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [budgetItems, incomes, existingBudget, initialized, draftLoaded, saveDraft, periodChanged])
  
  // Save draft and show toast when leaving page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveDraft()) {
        // Can't show toast on beforeunload, but draft is saved
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveDraft])
  
  // Clear draft when successfully saving
  const clearDraft = useCallback(() => {
    try {
      const draftKey = getDraftKey(period)
      localStorage.removeItem(draftKey)
      lastSavedRef.current = ''
    } catch (e) {
      console.error('Failed to clear draft:', e)
    }
  }, [period, getDraftKey])
  
  // Handle period change - load draft or defaults for new period
  const handlePeriodChange = useCallback((newPeriod: string) => {
    if (newPeriod === period) return
    
    // Save current draft before switching (silent)
    if (initialized && !existingBudget) {
      const hasData = Object.keys(budgetItems).some(k => budgetItems[k].total > 0) ||
                      incomes.some(inc => inc.amount > 0)
      if (hasData) {
        try {
          const currentDraftKey = getDraftKey(period)
          const draft = { 
            budgetItems, 
            incomes: incomes.map(inc => ({ id: inc.id, amount: inc.amount })),
            savedAt: new Date().toISOString() 
          }
          localStorage.setItem(currentDraftKey, JSON.stringify(draft))
        } catch (e) {
          console.error('Failed to save draft before period change:', e)
        }
      }
    }
    
    setPeriod(newPeriod)
    setPeriodChanged(true)
  }, [period, budgetItems, incomes, initialized, existingBudget, getDraftKey])
  
  // Load draft when period changes
  useEffect(() => {
    if (!periodChanged || !initialized || existingBudget || !householdData) return
    
    const allCategories = [...fixed, ...variable, ...savings]
    if (allCategories.length === 0) return
    
    try {
      const draftKey = getDraftKey(period)
      const savedDraft = localStorage.getItem(draftKey)
      
      if (savedDraft) {
        const draft = JSON.parse(savedDraft)
        if (draft.budgetItems && Object.keys(draft.budgetItems).length > 0) {
          // Use draft values, but ensure all categories are present
          const items: Record<string, BudgetItemState> = {}
          allCategories.forEach(cat => {
            if (draft.budgetItems[cat.id]) {
              items[cat.id] = draft.budgetItems[cat.id]
            } else {
              items[cat.id] = {
                total: cat.default_value || 0,
                isSplit: false,
                hasExplicitSplit: false,
                is_ccm: false,
              }
            }
          })
          setBudgetItems(items)

          // Load incomes from draft if available
          if (draft.incomes && Array.isArray(draft.incomes)) {
            const draftIncomeMap = new Map<string, number>(draft.incomes.map((i: {id: string, amount: number}) => [i.id, i.amount]))
            const restoredIncomes: IncomeState[] = []

            householdData.userIncomes.forEach(inc => {
              restoredIncomes.push({
                id: inc.id,
                name: inc.name,
                amount: draftIncomeMap.has(inc.id) ? (draftIncomeMap.get(inc.id) ?? inc.amount) : inc.amount,
                isUser: true,
              })
            })

            householdData.partnerIncomes.forEach(inc => {
              restoredIncomes.push({
                id: inc.id,
                name: inc.name,
                amount: draftIncomeMap.has(inc.id) ? (draftIncomeMap.get(inc.id) ?? inc.amount) : inc.amount,
                isUser: false,
              })
            })

            setIncomes(restoredIncomes)
          }
          
          lastSavedRef.current = JSON.stringify({ budgetItems: items, incomes: draft.incomes || [] })
          setPeriodChanged(false)
          return
        }
      }
      
      // No draft - use category defaults with auto-fill from loans and CCM and reset incomes to database values
      const items: Record<string, BudgetItemState> = {}
      allCategories.forEach(cat => {
        let defaultValue = cat.default_value || 0

        // Auto-fill "Ränta bolån" from loan interest
        if (cat.name === 'Ränta bolån' && loanTotals.totalInterest > 0) {
          defaultValue = loanTotals.totalInterest
        }
        // Auto-fill "Amortering" from loan amortization
        else if (cat.name === 'Amortering' && loanTotals.totalAmortization > 0) {
          defaultValue = loanTotals.totalAmortization
        }
        // Auto-fill "Kreditkort" from CCM invoice with per-partner split
        else if (cat.name === 'Kreditkort' && ccmInvoice?.actual_amount && ccmInvoice.actual_amount > 0) {
          defaultValue = ccmInvoice.actual_amount

          if (user && partner) {
            const grouped = groupExpensesByInvoicePeriod(ccmExpenses, invoiceBreakDate)
            const periodExpenses = grouped.get(period) || []
            const split = calculatePaymentSplit(periodExpenses, defaultValue, user.id, partner.id)

            items[cat.id] = {
              total: defaultValue,
              userAmount: Math.round(split.userAmount),
              partnerAmount: Math.round(split.partnerAmount),
              isSplit: false,
              hasExplicitSplit: true,
              is_ccm: true,
            }
            return
          }
        }

        items[cat.id] = {
          total: defaultValue,
          isSplit: false,
          hasExplicitSplit: false,
          is_ccm: cat.name === 'Kreditkort',
        }
      })
      setBudgetItems(items)

      // Reset incomes to original database values
      const originalIncomes: IncomeState[] = []
      householdData.userIncomes.forEach(inc => {
        originalIncomes.push({
          id: inc.id,
          name: inc.name,
          amount: inc.amount,
          isUser: true,
        })
      })
      householdData.partnerIncomes.forEach(inc => {
        originalIncomes.push({
          id: inc.id,
          name: inc.name,
          amount: inc.amount,
          isUser: false,
        })
      })
      setIncomes(originalIncomes)
      
      // Set lastSavedRef to the reset state so auto-save doesn't immediately trigger
      lastSavedRef.current = JSON.stringify({ 
        budgetItems: items, 
        incomes: originalIncomes.map(inc => ({ id: inc.id, amount: inc.amount })) 
      })
    } catch (e) {
      console.error('Failed to load draft for new period:', e)
    }
    
    setPeriodChanged(false)
  }, [period, periodChanged, initialized, existingBudget, fixed, variable, savings, getDraftKey, householdData, ccmInvoice, ccmExpenses, invoiceBreakDate, user, partner])

  // Initialize incomes from database
  // Prefer monthly incomes for the period if they exist, otherwise fall back to static incomes
  useEffect(() => {
    if (incomesInitialized || incomesLoading || monthlyIncomesLoading || !householdData) return

    const allIncomes: IncomeState[] = []

    // Check if we have monthly incomes for this period
    const hasMonthlyIncomes = monthlyIncomes && monthlyIncomes.length > 0

    if (hasMonthlyIncomes) {
      // Use monthly incomes (preferred for budget accuracy)
      monthlyIncomes.forEach(inc => {
        allIncomes.push({
          id: inc.id,
          name: inc.name,
          amount: inc.amount,
          isUser: inc.is_own,
        })
      })
    } else {
      // Fall back to static incomes if no monthly incomes exist
      householdData.userIncomes.forEach(inc => {
        allIncomes.push({
          id: inc.id,
          name: inc.name,
          amount: inc.amount,
          isUser: true,
        })
      })

      householdData.partnerIncomes.forEach(inc => {
        allIncomes.push({
          id: inc.id,
          name: inc.name,
          amount: inc.amount,
          isUser: false,
        })
      })
    }

    setIncomes(allIncomes)
    setIncomesInitialized(true)
  }, [householdData, incomesLoading, incomesInitialized, monthlyIncomes, monthlyIncomesLoading])

  // Initialize budget items from existing budget, draft, or category defaults
  useEffect(() => {
    if (initialized || categoriesLoading || !householdData) return
    
    const allCategories = [...fixed, ...variable, ...savings]
    if (allCategories.length === 0) return

    if (existingBudget?.budget_items) {
      // Editing existing budget - use its values, restore assignments
      const items: Record<string, BudgetItemState> = {}
      existingBudget.budget_items.forEach(item => {
        if (item.category_id) {
          const assignment = item.budget_item_assignments?.find(a => a.user_id === user?.id)
          if (assignment) {
            const userAmount = assignment.amount
            const partnerAmount = item.amount - userAmount
            items[item.category_id] = {
              total: item.amount,
              userAmount,
              partnerAmount,
              isSplit: false,
              hasExplicitSplit: true,
              is_ccm: item.is_ccm || false,
            }
          } else {
            items[item.category_id] = {
              total: item.amount,
              isSplit: false,
              hasExplicitSplit: false,
              is_ccm: item.is_ccm || false,
            }
          }
        }
      })
      setBudgetItems(items)
      setInitialized(true)
      setDraftLoaded(true)
    } else {
      // New budget - check for draft first
      try {
        const draftKey = `budget-draft-${period}`
        const savedDraft = localStorage.getItem(draftKey)
        
        if (savedDraft) {
          const draft = JSON.parse(savedDraft)
          if (draft.budgetItems && Object.keys(draft.budgetItems).length > 0) {
            // Use draft budget items, but ensure all categories are present
            const items: Record<string, BudgetItemState> = {}
            allCategories.forEach(cat => {
              if (draft.budgetItems[cat.id]) {
                items[cat.id] = draft.budgetItems[cat.id]
              } else {
                items[cat.id] = {
                  total: cat.default_value || 0,
                  isSplit: false,
                  hasExplicitSplit: false,
                  is_ccm: false,
                }
              }
            })
            setBudgetItems(items)

            // Load incomes from draft if available
            if (draft.incomes && Array.isArray(draft.incomes)) {
              const draftIncomeMap = new Map<string, number>(draft.incomes.map((i: {id: string, amount: number}) => [i.id, i.amount]))
              const restoredIncomes: IncomeState[] = []

              householdData.userIncomes.forEach(inc => {
                restoredIncomes.push({
                  id: inc.id,
                  name: inc.name,
                  amount: draftIncomeMap.has(inc.id) ? (draftIncomeMap.get(inc.id) ?? inc.amount) : inc.amount,
                  isUser: true,
                })
              })

              householdData.partnerIncomes.forEach(inc => {
                restoredIncomes.push({
                  id: inc.id,
                  name: inc.name,
                  amount: draftIncomeMap.has(inc.id) ? (draftIncomeMap.get(inc.id) ?? inc.amount) : inc.amount,
                  isUser: false,
                })
              })

              setIncomes(restoredIncomes)
              setIncomesInitialized(true)
            }

            setInitialized(true)
            setDraftLoaded(true)
            return
          }
        }
      } catch (e) {
        console.error('Failed to load draft during init:', e)
      }
      
      // No draft - use category defaults with auto-fill from loans and CCM
      const items: Record<string, BudgetItemState> = {}
      allCategories.forEach(cat => {
        let defaultValue = cat.default_value || 0

        // Auto-fill "Ränta bolån" from loan interest
        if (cat.name === 'Ränta bolån' && loanTotals.totalInterest > 0) {
          defaultValue = loanTotals.totalInterest
        }
        // Auto-fill "Amortering" from loan amortization
        else if (cat.name === 'Amortering' && loanTotals.totalAmortization > 0) {
          defaultValue = loanTotals.totalAmortization
        }
        // Auto-fill "Kreditkort" from CCM invoice with per-partner split
        else if (cat.name === 'Kreditkort' && ccmInvoice?.actual_amount && ccmInvoice.actual_amount > 0) {
          defaultValue = ccmInvoice.actual_amount

          if (user && partner) {
            const grouped = groupExpensesByInvoicePeriod(ccmExpenses, invoiceBreakDate)
            const periodExpenses = grouped.get(period) || []
            const split = calculatePaymentSplit(periodExpenses, defaultValue, user.id, partner.id)

            items[cat.id] = {
              total: defaultValue,
              userAmount: Math.round(split.userAmount),
              partnerAmount: Math.round(split.partnerAmount),
              isSplit: false,
              hasExplicitSplit: true,
              is_ccm: true,
            }
            return
          }
        }

        items[cat.id] = {
          total: defaultValue,
          isSplit: false,
          hasExplicitSplit: false,
          is_ccm: cat.name === 'Kreditkort',
        }
      })
      setBudgetItems(items)
      setInitialized(true)
      setDraftLoaded(true)
    }
  }, [existingBudget, fixed, variable, savings, categoriesLoading, initialized, period, householdData, loanTotals, ccmInvoice, ccmExpenses, invoiceBreakDate, user, partner])

  // Calculations
  const userIncome = useMemo(() => 
    incomes.filter(i => i.isUser).reduce((sum, i) => sum + i.amount, 0),
    [incomes]
  )
  
  const partnerIncome = useMemo(() => 
    incomes.filter(i => !i.isUser).reduce((sum, i) => sum + i.amount, 0),
    [incomes]
  )
  
  const totalIncome = userIncome + partnerIncome
  
  const totalFixed = useMemo(() => 
    fixed.reduce((sum, cat) => sum + (budgetItems[cat.id]?.total || 0), 0),
    [fixed, budgetItems]
  )
  
  const totalVariable = useMemo(() => 
    variable.reduce((sum, cat) => sum + (budgetItems[cat.id]?.total || 0), 0),
    [variable, budgetItems]
  )
  
  const totalSavings = useMemo(() => 
    savings.reduce((sum, cat) => sum + (budgetItems[cat.id]?.total || 0), 0),
    [savings, budgetItems]
  )

  // Calculate per-partner totals (excluding CCM expenses since they're paid next month)
  const { userExpenses, partnerExpenses, userSavings, partnerSavings } = useMemo(() => {
    let userExp = 0
    let partnerExp = 0
    let userSav = 0
    let partnerSav = 0

    const processCategories = (categories: Category[], isSavings: boolean) => {
      categories.forEach(cat => {
        const item = budgetItems[cat.id]
        if (!item) return

        // Skip CCM items for expense calculations (they're paid next month)
        if (!isSavings && item.is_ccm) return

        // Use explicit amounts if they exist, otherwise divide 50/50
        const hasExplicitAmounts = item.userAmount !== undefined && item.partnerAmount !== undefined
        const userAmt = hasExplicitAmounts ? item.userAmount! : item.total / 2
        const partnerAmt = hasExplicitAmounts ? item.partnerAmount! : item.total / 2

        if (isSavings) {
          userSav += userAmt
          partnerSav += partnerAmt
        } else {
          userExp += userAmt
          partnerExp += partnerAmt
        }
      })
    }

    processCategories(fixed, false)
    processCategories(variable, false)
    processCategories(savings, true)

    return { userExpenses: userExp, partnerExpenses: partnerExp, userSavings: userSav, partnerSavings: partnerSav }
  }, [fixed, variable, savings, budgetItems])
  
  const totalExpenses = totalFixed + totalVariable

  // Calculate CCM totals
  const totalCCM = useMemo(() => {
    return [...fixed, ...variable].reduce((sum, cat) => {
      const item = budgetItems[cat.id]
      return sum + (item?.is_ccm ? (item.total || 0) : 0)
    }, 0)
  }, [fixed, variable, budgetItems])

  const totalCashflow = totalExpenses - totalCCM

  // Only cashflow expenses + savings affect this month's balance (CCM is paid next month)
  const totalBudgeted = totalCashflow + totalSavings
  const remaining = totalIncome - totalBudgeted  // CCM does NOT reduce remaining this month
  const userRemaining = userIncome - userExpenses - userSavings
  const partnerRemaining = partnerIncome - partnerExpenses - partnerSavings
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0
  const budgetUsage = totalIncome > 0 ? (totalBudgeted / totalIncome) * 100 : 0

  const updateIncome = (id: string, amount: number) => {
    setIncomes(prev => prev.map(inc => 
      inc.id === id ? { ...inc, amount } : inc
    ))
  }

  const updateItem = (categoryId: string, value: number) => {
    // When updating via main field, don't set individual amounts - keep it simple
    setBudgetItems(prev => {
      const current = prev[categoryId] || { total: 0, isSplit: false, hasExplicitSplit: false, is_ccm: false }
      return {
        ...prev,
        [categoryId]: {
          total: value,
          userAmount: undefined,
          partnerAmount: undefined,
          isSplit: false,
          hasExplicitSplit: false,
          is_ccm: current.is_ccm, // Preserve CCM status
        },
      }
    })
  }

  const updateItemSplit = (categoryId: string, userAmount: number, partnerAmount: number) => {
    // Mark as explicit split only if amounts are actually different
    const hasExplicitSplit = userAmount !== partnerAmount
    setBudgetItems(prev => {
      const current = prev[categoryId] || { total: 0, isSplit: false, hasExplicitSplit: false, is_ccm: false }
      return {
        ...prev,
        [categoryId]: {
          total: userAmount + partnerAmount,
          userAmount,
          partnerAmount,
          isSplit: true,
          hasExplicitSplit,
          is_ccm: current.is_ccm, // Preserve CCM status
        },
      }
    })
  }

  const toggleSplit = (categoryId: string) => {
    setBudgetItems(prev => {
      const current = prev[categoryId] || { total: 0, isSplit: false, hasExplicitSplit: false, is_ccm: false }

      if (current.isSplit) {
        // Closing split view - keep the amounts and explicit split flag
        return {
          ...prev,
          [categoryId]: {
            ...current,
            isSplit: false,
          },
        }
      } else {
        // Opening split view - use existing amounts if they exist, otherwise calculate half
        const hasExistingAmounts = current.userAmount !== undefined && current.partnerAmount !== undefined
        const userAmount = hasExistingAmounts ? current.userAmount! : Math.floor(current.total / 2)
        const partnerAmount = hasExistingAmounts ? current.partnerAmount! : (current.total - Math.floor(current.total / 2))

        return {
          ...prev,
          [categoryId]: {
            total: current.total,
            userAmount,
            partnerAmount,
            isSplit: true,
            hasExplicitSplit: current.hasExplicitSplit,
            is_ccm: current.is_ccm,
          },
        }
      }
    })
  }

  const toggleCCM = (categoryId: string) => {
    setBudgetItems(prev => {
      const current = prev[categoryId] || { total: 0, isSplit: false, hasExplicitSplit: false, is_ccm: false }

      return {
        ...prev,
        [categoryId]: {
          ...current,
          is_ccm: !current.is_ccm,
        },
      }
    })
  }

  const toggleSection = (section: 'income' | 'fixed' | 'variable' | 'savings') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const copyFromPrevious = () => {
    if (!previousBudget?.budget_items) return

    const newItems: Record<string, BudgetItemState> = { ...budgetItems }
    previousBudget.budget_items.forEach(item => {
      if (item.category_id) {
        newItems[item.category_id] = {
          total: item.amount,
          userAmount: undefined,
          partnerAmount: undefined,
          isSplit: false,
          hasExplicitSplit: false,
          is_ccm: item.is_ccm || false,
        }
      }
    })
    setBudgetItems(newItems)
    setShowCopyConfirm(false)
    toast.success('Värden kopierade från föregående månad! 📋')
  }

  async function handleDelete() {
    if (!existingBudget) return

    try {
      await deleteBudget.mutateAsync(existingBudget.id)
      toast.success('Budget borttagen! 🗑️')
      router.push('/budget')
    } catch (error) {
      console.error('Failed to delete budget:', error)
      toast.error('Kunde inte ta bort budget')
    }
  }

  async function handleSubmit() {
    if (!user) return
    setSaving(true)

    try {
      const budgetData = {
        period,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        total_cashflow_expenses: totalCashflow,
        total_ccm_expenses: totalCCM,
        total_savings: totalSavings,
        net_balance: remaining,
        savings_ratio: savingsRate,
      }

      let budgetId: string

      if (existingBudget) {
        await updateBudget.mutateAsync({ id: existingBudget.id, ...budgetData })
        budgetId = existingBudget.id
        await supabase.from('budget_items').delete().eq('budget_id', budgetId)
      } else {
        const result = await createBudget.mutateAsync(budgetData)
        budgetId = result.id
      }

      const items: Omit<BudgetItem, 'id' | 'created_at'>[] = []
      
      const addItems = (categories: Category[], type: 'fixedExpense' | 'variableExpense' | 'savings') => {
        categories.forEach(cat => {
          const item = budgetItems[cat.id]
          if (item && item.total > 0) {
            items.push({
              budget_id: budgetId,
              category_id: cat.id,
              name: cat.name,
              type,
              amount: item.total,
              is_ccm: item.is_ccm || false,
            })
          }
        })
      }

      addItems(fixed, 'fixedExpense')
      addItems(variable, 'variableExpense')
      addItems(savings, 'savings')

      if (items.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: insertedItems, error: itemsError } = await (supabase.from('budget_items') as any).insert(items).select()
        if (itemsError) throw itemsError

        // Insert budget_item_assignments for items with explicit splits
        if (insertedItems && insertedItems.length > 0) {
          const assignments: { budget_item_id: string; user_id: string; amount: number }[] = []

          insertedItems.forEach((inserted: { id: string; category_id: string }) => {
            const itemState = budgetItems[inserted.category_id]
            if (itemState?.hasExplicitSplit && itemState.userAmount !== undefined) {
              assignments.push({
                budget_item_id: inserted.id,
                user_id: user.id,
                amount: itemState.userAmount,
              })
            }
          })

          if (assignments.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: assignError } = await (supabase.from('budget_item_assignments') as any).insert(assignments)
            if (assignError) throw assignError
          }
        }
      }

      // Clear draft on successful save
      clearDraft()
      
      toast.success(existingBudget ? 'Budget uppdaterad!' : 'Budget skapad! 🎉')
      router.push('/budget')
      router.refresh()
    } catch (error) {
      console.error('Budget save error:', error)
      toast.error('Kunde inte spara budget')
    } finally {
      setSaving(false)
    }
  }

  if (categoriesLoading || incomesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-hb-cognac" />
      </div>
    )
  }

  const userName = user?.first_name || 'Du'
  const partnerName = partner?.first_name || 'Partner'
  const hasPartner = !!partner

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-hb-cognac">
            {existingBudget ? 'Redigera budget' : 'Ny budget'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatPeriodDisplay(period)}
          </p>
        </div>
      </motion.div>

      {/* Period Picker */}
      {!existingBudget && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <button
                onClick={() => setShowPeriodPicker(!showPeriodPicker)}
                className="w-full flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-muted-foreground">Budgetperiod</p>
                  <p className="font-semibold capitalize">{formatPeriodDisplay(period)}</p>
                </div>
                <ChevronDown className={cn(
                  "w-5 h-5 text-muted-foreground transition-transform",
                  showPeriodPicker && "rotate-180"
                )} />
              </button>
              
              <AnimatePresence>
                {showPeriodPicker && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 grid grid-cols-2 gap-2">
                      {availablePeriods.map(p => (
                        <button
                          key={p.period}
                          onClick={() => {
                            handlePeriodChange(p.period)
                            setShowPeriodPicker(false)
                          }}
                          className={cn(
                            "p-3 rounded-lg text-sm text-left transition-all",
                            period === p.period
                              ? "bg-hb-cognac text-white"
                              : "bg-muted hover:bg-muted/80"
                          )}
                        >
                          <span className="capitalize">{formatPeriodDisplay(p.period)}</span>
                          {p.period === currentPeriod.period && (
                            <span className="block text-xs opacity-70">Aktuell</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Already Saved Budget Info */}
      {periodAlreadyHasBudget && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Budget redan sparad för {formatPeriodDisplay(period)}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Du kan se värdena nedan, men för att redigera behöver du gå via budgetsidan.
                  </p>
                  <Link 
                    href={`/budget/${existingPeriodBudget?.id}`}
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Gå till budgeten för att redigera
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Previous Budget Controls */}
      {!existingBudget && !periodAlreadyHasBudget && previousBudget && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Card className="border-0 shadow-sm bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <History className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">Föregående månad</p>
                    <p className="text-xs text-muted-foreground">
                      Visa budgeterade värden
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={showPreviousValues}
                    onCheckedChange={setShowPreviousValues}
                    className="data-[state=checked]:bg-amber-500"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCopyConfirm(true)}
                    className="gap-1.5 border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-950"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Kopiera</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Income Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-0 shadow-sm overflow-hidden bg-gradient-to-br from-hb-sage/20 to-hb-sand/20">
          <button
            onClick={() => toggleSection('income')}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-hb-cognac/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-hb-cognac" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Inkomster</p>
                <p className="text-xs text-muted-foreground">
                  {hasPartner ? `${userName} + ${partnerName}` : 'Din inkomst'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-hb-cognac">
                {formatCurrency(totalIncome)}
              </span>
              {expandedSections.income ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>

          <AnimatePresence>
            {expandedSections.income && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  {/* User incomes */}
                  {incomes.filter(i => i.isUser).length > 0 && (
                    <div className="space-y-2">
                      {hasPartner && (
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <User className="w-3 h-3" /> {userName}
                        </p>
                      )}
                      {incomes.filter(i => i.isUser).map(inc => (
                        <div key={inc.id} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                          <span className="flex-1 text-sm truncate">{inc.name}</span>
                          <div className="relative w-28">
                            {periodAlreadyHasBudget ? (
                              <div className="w-full h-9 px-3 pr-8 text-right text-sm rounded-lg bg-muted/30 flex items-center justify-end">
                                <span className="font-medium">{inc.amount || 0}</span>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  kr
                                </span>
                              </div>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={inc.amount || ''}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                                    updateIncome(inc.id, value)
                                  }}
                                  placeholder="0"
                                  className="w-full h-9 px-3 pr-8 text-right text-sm rounded-lg bg-muted focus:outline-none focus:ring-1 focus:ring-hb-cognac"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  kr
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Partner incomes */}
                  {hasPartner && incomes.filter(i => !i.isUser).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <User className="w-3 h-3" /> {partnerName}
                      </p>
                      {incomes.filter(i => !i.isUser).map(inc => (
                        <div key={inc.id} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                          <span className="flex-1 text-sm truncate">{inc.name}</span>
                          <div className="relative w-28">
                            {periodAlreadyHasBudget ? (
                              <div className="w-full h-9 px-3 pr-8 text-right text-sm rounded-lg bg-muted/30 flex items-center justify-end">
                                <span className="font-medium">{inc.amount || 0}</span>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  kr
                                </span>
                              </div>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={inc.amount || ''}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                                    updateIncome(inc.id, value)
                                  }}
                                  placeholder="0"
                                  className="w-full h-9 px-3 pr-8 text-right text-sm rounded-lg bg-muted focus:outline-none focus:ring-1 focus:ring-hb-cognac"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  kr
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {incomes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Inga inkomster registrerade. Lägg till inkomster i inställningar.
                    </p>
                  )}

                  {/* Summary */}
                  {hasPartner && incomes.length > 0 && (
                    <div className="pt-2 border-t border-border/50 flex justify-between text-sm">
                      <div>
                        <span className="text-muted-foreground">{userName}:</span>
                        <span className="ml-1 font-medium">{formatCurrency(userIncome)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{partnerName}:</span>
                        <span className="ml-1 font-medium">{formatCurrency(partnerIncome)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Fixed Expenses */}
      <CategorySection
        title="Fasta kostnader"
        icon={<TrendingDown className="w-4 h-4" />}
        categories={fixed}
        budgetItems={periodAlreadyHasBudget ?
          mapBudgetItemsToCurrentCategories(existingPeriodBudget?.budget_items, fixed)
          : budgetItems
        }
        onUpdateItem={updateItem}
        onUpdateSplit={updateItemSplit}
        onToggleSplit={toggleSplit}
        onToggleCCM={toggleCCM}
        total={periodAlreadyHasBudget ?
          Object.values(mapBudgetItemsToCurrentCategories(existingPeriodBudget?.budget_items, fixed))
            .reduce((sum, item) => sum + item.total, 0)
          : totalFixed
        }
        expanded={expandedSections.fixed}
        onToggle={() => toggleSection('fixed')}
        delay={0.15}
        hasPartner={hasPartner}
        userName={userName}
        partnerName={partnerName}
        previousAmounts={previousAmounts}
        showPreviousValues={showPreviousValues && !periodAlreadyHasBudget}
        readOnly={periodAlreadyHasBudget}
        ccmEnabled={user?.ccm_enabled}
      />

      {/* Variable Expenses */}
      <CategorySection
        title="Rörliga kostnader"
        icon={<TrendingDown className="w-4 h-4" />}
        categories={variable}
        budgetItems={periodAlreadyHasBudget ?
          mapBudgetItemsToCurrentCategories(existingPeriodBudget?.budget_items, variable)
          : budgetItems
        }
        onUpdateItem={updateItem}
        onUpdateSplit={updateItemSplit}
        onToggleSplit={toggleSplit}
        onToggleCCM={toggleCCM}
        total={periodAlreadyHasBudget ?
          Object.values(mapBudgetItemsToCurrentCategories(existingPeriodBudget?.budget_items, variable))
            .reduce((sum, item) => sum + item.total, 0)
          : totalVariable
        }
        expanded={expandedSections.variable}
        onToggle={() => toggleSection('variable')}
        delay={0.2}
        hasPartner={hasPartner}
        userName={userName}
        partnerName={partnerName}
        previousAmounts={previousAmounts}
        showPreviousValues={showPreviousValues && !periodAlreadyHasBudget}
        readOnly={periodAlreadyHasBudget}
        ccmEnabled={user?.ccm_enabled}
      />

      {/* Savings */}
      <CategorySection
        title="Sparande"
        icon={<PiggyBank className="w-4 h-4" />}
        categories={savings}
        budgetItems={periodAlreadyHasBudget ?
          mapBudgetItemsToCurrentCategories(existingPeriodBudget?.budget_items, savings)
          : budgetItems
        }
        onUpdateItem={updateItem}
        onUpdateSplit={updateItemSplit}
        onToggleSplit={toggleSplit}
        total={periodAlreadyHasBudget ?
          Object.values(mapBudgetItemsToCurrentCategories(existingPeriodBudget?.budget_items, savings))
            .reduce((sum, item) => sum + item.total, 0)
          : totalSavings
        }
        expanded={expandedSections.savings}
        onToggle={() => toggleSection('savings')}
        delay={0.25}
        accentColor="success"
        hasPartner={hasPartner}
        userName={userName}
        partnerName={partnerName}
        previousAmounts={previousAmounts}
        showPreviousValues={showPreviousValues && !periodAlreadyHasBudget}
        readOnly={periodAlreadyHasBudget}
      />

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sammanfattning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Budgeterat</span>
                <span className="font-medium">{formatCurrency(totalBudgeted)} / {formatCurrency(totalIncome)}</span>
              </div>
              <Progress value={Math.min(budgetUsage, 100)} className="h-2" />
            </div>

            <div className="space-y-3">
              {/* First row: Fasta & Rörliga */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground text-xs">Kassaflöde (Fasta + Rörliga)</p>
                  <p className="font-semibold">{formatCurrency(totalCashflow)}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <p className="text-muted-foreground text-xs">Sparande</p>
                  <p className="font-semibold text-success">{formatCurrency(totalSavings)}</p>
                </div>
              </div>

              {/* CCM row - only show if CCM is enabled and has CCM expenses */}
              {user?.ccm_enabled && totalCCM > 0 && (
                <div className="p-3 rounded-lg bg-hb-sand-deep/10 border border-hb-terracotta/20">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-hb-terracotta" />
                    <p className="text-muted-foreground text-xs">CCM (betalas nästa månad)</p>
                  </div>
                  <p className="font-semibold text-hb-terracotta">{formatCurrency(totalCCM)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Påverkar ej denna månads kassaflöde</p>
                </div>
              )}

              {/* Kvar totalt - full width */}
              <div className={cn(
                "p-4 rounded-lg",
                remaining >= 0 ? "bg-hb-tim/10" : "bg-destructive/10"
              )}>
                <p className="text-muted-foreground text-xs">Kvar totalt</p>
                <p className={cn(
                  "text-2xl font-bold",
                  remaining >= 0 ? "text-hb-tim" : "text-destructive"
                )}>
                  {formatCurrency(remaining)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Efter kassaflöde och sparande {user?.ccm_enabled && totalCCM > 0 && '(CCM ej inräknat)'}
                </p>
              </div>
            </div>

            {/* Per-partner remaining - only show if partner exists */}
            {hasPartner && (
              <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                <div className={cn(
                  "p-3 rounded-lg",
                  userRemaining >= 0 ? "bg-hb-sage/20" : "bg-destructive/10"
                )}>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <User className="w-3 h-3" /> {userName} kvar
                  </p>
                  <p className={cn(
                    "font-semibold",
                    userRemaining >= 0 ? "text-hb-cognac" : "text-destructive"
                  )}>
                    {formatCurrency(userRemaining)}
                  </p>
                </div>
                <div className={cn(
                  "p-3 rounded-lg",
                  partnerRemaining >= 0 ? "bg-hb-sage/20" : "bg-destructive/10"
                )}>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <User className="w-3 h-3" /> {partnerName} kvar
                  </p>
                  <p className={cn(
                    "font-semibold",
                    partnerRemaining >= 0 ? "text-hb-cognac" : "text-destructive"
                  )}>
                    {formatCurrency(partnerRemaining)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-success" />
                <span className="text-sm">Sparkvot</span>
              </div>
              <span className={cn(
                "font-bold",
                savingsRate >= 10 ? "text-success" : "text-muted-foreground"
              )}>
                {formatPercentage(savingsRate)}
              </span>
            </div>

            {remaining < 0 && (
              <p className="text-xs text-destructive text-center">
                ⚠️ Du har budgeterat mer än din inkomst med {formatCurrency(Math.abs(remaining))}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Save Button - hide if viewing an already saved budget */}
      {!periodAlreadyHasBudget && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent keyboard-adjust">
          <div className={cn(
            "flex gap-2",
            existingBudget ? "flex-row" : "flex-col"
          )}>
            <Button
              onClick={handleSubmit}
              disabled={saving || totalIncome === 0}
              className={cn("h-12", existingBudget ? "flex-1" : "w-full")}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sparar...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {existingBudget ? 'Uppdatera budget' : 'Skapa budget'}
                </>
              )}
            </Button>

            {existingBudget && (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="destructive"
                className="h-12"
                disabled={saving}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Link to edit when viewing saved budget */}
      {periodAlreadyHasBudget && existingPeriodBudget && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent keyboard-adjust">
          <Link href={`/budget/${existingPeriodBudget.id}`} className="block">
            <Button variant="outline" className="w-full h-12 gap-2">
              <ExternalLink className="w-4 h-4" />
              Redigera denna budget
            </Button>
          </Link>
        </div>
      )}

      {/* Copy Confirmation Dialog */}
      <AlertDialog open={showCopyConfirm} onOpenChange={setShowCopyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-amber-500" />
              Kopiera från föregående månad?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Detta kommer att ersätta alla nuvarande värden (förutom inkomster) med värdena från föregående månads budget.
              <br /><br />
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Alla ändringar du gjort kommer att skrivas över.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={copyFromPrevious}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Ja, kopiera värden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Ta bort budget?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort budgeten för <span className="font-semibold">{formatPeriodDisplay(period)}</span>?
              <br /><br />
              <span className="text-destructive font-medium">
                Denna åtgärd går inte att ångra.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Ja, ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface CategorySectionProps {
  title: string
  icon: React.ReactNode
  categories: Category[]
  budgetItems: Record<string, BudgetItemState>
  onUpdateItem: (categoryId: string, value: number) => void
  onUpdateSplit: (categoryId: string, userAmount: number, partnerAmount: number) => void
  onToggleSplit: (categoryId: string) => void
  onToggleCCM?: (categoryId: string) => void
  total: number
  expanded: boolean
  onToggle: () => void
  delay: number
  accentColor?: 'default' | 'success'
  hasPartner: boolean
  userName: string
  partnerName: string
  previousAmounts: Record<string, number>
  showPreviousValues: boolean
  readOnly?: boolean
  ccmEnabled?: boolean
}

function CategorySection({
  title,
  icon,
  categories,
  budgetItems,
  onUpdateItem,
  onUpdateSplit,
  onToggleSplit,
  onToggleCCM,
  total,
  expanded,
  onToggle,
  delay,
  accentColor = 'default',
  hasPartner,
  userName,
  partnerName,
  previousAmounts,
  showPreviousValues,
  readOnly = false,
  ccmEnabled = false,
}: CategorySectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="border-0 shadow-sm overflow-hidden">
        <button
          onClick={onToggle}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              accentColor === 'success' ? "bg-success/10 text-success" : "bg-hb-cognac/10 text-hb-cognac"
            )}>
              {icon}
            </div>
            <div className="text-left">
              <p className="font-medium text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">{categories.length} kategorier</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              "font-semibold",
              accentColor === 'success' && "text-success"
            )}>
              {formatCurrency(total)}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                {categories.map(cat => {
                  const item = budgetItems[cat.id] || { total: 0, isSplit: false, hasExplicitSplit: false, is_ccm: false }
                  // Only consider "amounts differ" if user has explicitly set different amounts
                  const amountsDiffer = hasPartner && item.hasExplicitSplit
                  const previousValue = previousAmounts[cat.name]
                  const hasPreviousValue = previousValue !== undefined && previousValue > 0

                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm truncate block">{cat.name}</span>
                          {/* Previous value hint - show below category name when toggle is on */}
                          <AnimatePresence>
                            {showPreviousValues && hasPreviousValue && (
                              <motion.span
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
                              >
                                <History className="w-3 h-3" />
                                Förra: {formatCurrency(previousValue)}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {/* CCM toggle button - only show if CCM enabled and not read-only */}
                        {ccmEnabled && !readOnly && onToggleCCM && (
                          <button
                            onClick={() => onToggleCCM(cat.id)}
                            className={cn(
                              "p-1.5 rounded-md transition-colors shrink-0",
                              item.is_ccm
                                ? "bg-hb-terracotta text-white"
                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                            )}
                            title={item.is_ccm ? "Kassaflöde" : "CCM (kreditkort)"}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Split toggle button - only show if has partner and not read-only */}
                        {hasPartner && !readOnly && (
                          <button
                            onClick={() => onToggleSplit(cat.id)}
                            className={cn(
                              "p-1.5 rounded-md transition-colors shrink-0",
                              item.isSplit || amountsDiffer
                                ? "bg-hb-cognac text-white"
                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                            )}
                            title={item.isSplit ? "Slå ihop" : "Dela upp per person"}
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Main amount field - show when NOT in split view */}
                        {!item.isSplit && (
                          <div className="relative w-28 shrink-0">
                            {readOnly ? (
                              // Read-only display
                              <div className="w-full h-9 px-3 pr-8 text-right text-sm rounded-lg bg-muted/30 flex items-center justify-end">
                                <span className="font-medium">{item.total || 0}</span>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  kr
                                </span>
                              </div>
                            ) : amountsDiffer ? (
                              // If amounts differ, clicking opens split view instead of editing
                              <button
                                onClick={() => onToggleSplit(cat.id)}
                                className="w-full h-9 px-3 pr-8 text-right text-sm rounded-lg bg-muted/50 border border-hb-cognac/30 cursor-pointer hover:bg-muted"
                              >
                                <span className="text-hb-cognac font-medium">{item.total}</span>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  kr
                                </span>
                              </button>
                            ) : (
                              // Normal editable input
                              <>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={item.total || ''}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                                    onUpdateItem(cat.id, value)
                                  }}
                                  placeholder="0"
                                  className="w-full h-9 px-3 pr-8 text-right text-sm rounded-lg bg-muted focus:outline-none focus:ring-1 focus:ring-hb-cognac"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  kr
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Total display when split - align with main field */}
                        {item.isSplit && hasPartner && (
                          <div className="w-28 shrink-0 text-right">
                            <span className="text-sm font-medium">{formatCurrency(item.total)}</span>
                          </div>
                        )}
                      </div>

                      {/* Split view - expanded below with left border, inputs aligned right */}
                      <AnimatePresence>
                        {item.isSplit && hasPartner && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-4 pl-3 border-l-2 border-hb-cognac/30 space-y-1.5 py-1">
                              {/* User amount */}
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-muted-foreground">{userName}</span>
                                <div className="relative w-28">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={item.userAmount || ''}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                                      onUpdateSplit(cat.id, value, item.partnerAmount || 0)
                                    }}
                                    placeholder="0"
                                    className="w-full h-8 px-3 pr-7 text-right text-sm rounded-md bg-muted/70 focus:outline-none focus:ring-1 focus:ring-hb-cognac"
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                    kr
                                  </span>
                                </div>
                              </div>
                              
                              {/* Partner amount */}
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-muted-foreground">{partnerName}</span>
                                <div className="relative w-28">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={item.partnerAmount || ''}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                                      onUpdateSplit(cat.id, item.userAmount || 0, value)
                                    }}
                                    placeholder="0"
                                    className="w-full h-8 px-3 pr-7 text-right text-sm rounded-md bg-muted/70 focus:outline-none focus:ring-1 focus:ring-hb-cognac"
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                    kr
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}
