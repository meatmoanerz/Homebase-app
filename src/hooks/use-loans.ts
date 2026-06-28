'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Loan, LoanWithGroup, LoanInterestHistory, Category } from '@/types'
import type { InsertTables, UpdateTables } from '@/types/database'

// Extended type for loans with owner information
export interface LoanWithOwner extends LoanWithGroup {
  is_partner_loan?: boolean
  owner_name?: string
}

// Fetch all loans with their groups (own loans only)
export function useLoans() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          loan_group:loan_groups(*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as LoanWithGroup[]
    },
  })
}

// Fetch partner's shared loans
export function usePartnerLoans() {
  return useQuery({
    queryKey: ['partner-loans'],
    queryFn: async () => {
      const response = await fetch('/api/partner-loans')
      const data = await response.json()

      if (data.error) {
        console.error('usePartnerLoans: API error:', data.error)
        return { loans: [], partnerId: null, partnerName: null }
      }

      return {
        loans: data.loans as LoanWithGroup[],
        partnerId: data.partnerId as string | null,
        partnerName: data.partnerName as string | null
      }
    },
    staleTime: 10 * 60 * 1000 // 10 min — sällan ändrad,
  })
}

// Fetch all loans including partner's shared loans
export function useAllLoans() {
  const { data: ownLoans, isLoading: ownLoading } = useLoans()
  const { data: partnerData, isLoading: partnerLoading } = usePartnerLoans()

  const isLoading = ownLoading || partnerLoading

  // Combine own loans and partner's shared loans
  const allLoans: LoanWithOwner[] = [
    ...(ownLoans || []).map(loan => ({
      ...loan,
      is_partner_loan: false,
      owner_name: undefined
    })),
    ...(partnerData?.loans || []).map(loan => ({
      ...loan,
      is_partner_loan: true,
      owner_name: partnerData?.partnerName || 'Partner'
    }))
  ]

  return {
    data: allLoans,
    isLoading,
    ownLoans: ownLoans || [],
    partnerLoans: partnerData?.loans || [],
    partnerName: partnerData?.partnerName || null
  }
}

// Fetch a single loan by ID
export function useLoan(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['loans', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          loan_group:loan_groups(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as LoanWithGroup
    },
    enabled: !!id,
  })
}

// Calculate total debt across all loans
export function useTotalDebt() {
  const { data: loans } = useLoans()
  return loans?.reduce((sum, loan) => sum + loan.current_balance, 0) ?? 0
}

// Calculate total monthly amortization
export function useTotalMonthlyAmortization() {
  const { data: loans } = useLoans()
  return loans?.reduce((sum, loan) => sum + loan.monthly_amortization, 0) ?? 0
}

// Create a new loan
export function useCreateLoan() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (loan: Omit<InsertTables<'loans'>, 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('loans') as any)
        .insert({
          ...loan,
          user_id: user.id,
        })
        .select(`
          *,
          loan_group:loan_groups(*)
        `)
        .single()

      if (error) throw error
      return data as LoanWithGroup
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      queryClient.invalidateQueries({ queryKey: ['loan-groups'] })
      queryClient.invalidateQueries({ queryKey: ['partner-loans'] })
    },
  })
}

// Update an existing loan
export function useUpdateLoan() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'loans'> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('loans') as any)
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          loan_group:loan_groups(*)
        `)
        .single()

      if (error) throw error
      return data as LoanWithGroup
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      queryClient.invalidateQueries({ queryKey: ['loans', data.id] })
      queryClient.invalidateQueries({ queryKey: ['partner-loans'] })
    },
  })
}

// Delete a loan
export function useDeleteLoan() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      queryClient.invalidateQueries({ queryKey: ['loan-groups'] })
      queryClient.invalidateQueries({ queryKey: ['partner-loans'] })
    },
  })
}

// Fetch interest rate history for a loan
export function useLoanInterestHistory(loanId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['loan-interest-history', loanId],
    queryFn: async () => {
      if (!loanId) return []

      const { data, error } = await supabase
        .from('loan_interest_history')
        .select('*')
        .eq('loan_id', loanId)
        .order('effective_date', { ascending: false })

      if (error) throw error
      return data as LoanInterestHistory[]
    },
    enabled: !!loanId,
  })
}

// Add a new interest rate to history
export function useAddInterestRate() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ loanId, rate, effectiveDate }: {
      loanId: string
      rate: number
      effectiveDate?: string
    }) => {
      // Add to history
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: historyError } = await (supabase.from('loan_interest_history') as any)
        .insert({
          loan_id: loanId,
          rate,
          effective_date: effectiveDate || new Date().toISOString().split('T')[0],
        })

      if (historyError) throw historyError

      // Update current rate on loan
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('loans') as any)
        .update({ interest_rate: rate })
        .eq('id', loanId)
        .select()
        .single()

      if (error) throw error
      return data as Loan
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      queryClient.invalidateQueries({ queryKey: ['loans', variables.loanId] })
      queryClient.invalidateQueries({ queryKey: ['loan-interest-history', variables.loanId] })
    },
  })
}

// Record amortization payment
export function useRecordAmortization() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ loanId, amount, date }: {
      loanId: string
      amount: number
      date?: string
    }) => {
      // Get current loan
      const { data: loan, error: fetchError } = await supabase
        .from('loans')
        .select('current_balance')
        .eq('id', loanId)
        .single() as { data: { current_balance: number } | null; error: Error | null }

      if (fetchError) throw fetchError
      if (!loan) throw new Error('Loan not found')

      const newBalance = Math.max(0, loan.current_balance - amount)

      // Update loan balance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('loans') as any)
        .update({
          current_balance: newBalance,
          last_amortization_date: date || new Date().toISOString().split('T')[0],
        })
        .eq('id', loanId)
        .select()
        .single()

      if (error) throw error
      return data as Loan
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      queryClient.invalidateQueries({ queryKey: ['loans', variables.loanId] })
    },
  })
}

// Calculate amortization plan for a loan
export function calculateAmortizationPlan(loan: Loan, months: number = 120) {
  const plan: {
    month: number
    payment: number
    principal: number
    interest: number
    balance: number
  }[] = []

  let balance = loan.current_balance
  const monthlyRate = loan.interest_rate / 100 / 12
  const monthlyAmortization = loan.monthly_amortization

  for (let month = 1; month <= months && balance > 0; month++) {
    const interest = balance * monthlyRate
    const principal = Math.min(monthlyAmortization, balance)
    const payment = principal + interest
    balance = Math.max(0, balance - principal)

    plan.push({
      month,
      payment: Math.round(payment),
      principal: Math.round(principal),
      interest: Math.round(interest),
      balance: Math.round(balance),
    })

    if (balance <= 0) break
  }

  return plan
}

// Calculate loan summary statistics
export function calculateLoanSummary(loan: Loan) {
  const monthlyRate = loan.interest_rate / 100 / 12
  const monthlyAmortization = loan.monthly_amortization

  // Calculate months to pay off
  let balance = loan.current_balance
  let monthsRemaining = 0
  let totalInterest = 0

  while (balance > 0 && monthsRemaining < 600) { // Max 50 years
    const interest = balance * monthlyRate
    totalInterest += interest
    balance = Math.max(0, balance - monthlyAmortization)
    monthsRemaining++
  }

  // Monthly interest cost (current)
  const monthlyInterestCost = loan.current_balance * monthlyRate

  // Total monthly cost
  const totalMonthlyCost = monthlyAmortization + monthlyInterestCost

  // Progress
  const paidOff = loan.original_amount - loan.current_balance
  const progressPercent = (paidOff / loan.original_amount) * 100

  return {
    monthsRemaining,
    yearsRemaining: Math.ceil(monthsRemaining / 12),
    totalInterest: Math.round(totalInterest),
    monthlyInterestCost: Math.round(monthlyInterestCost),
    totalMonthlyCost: Math.round(totalMonthlyCost),
    paidOff: Math.round(paidOff),
    progressPercent: Math.round(progressPercent * 10) / 10,
  }
}

// Type for loan group
interface LoanGroupBasic {
  id: string
  name: string
}

// Get loan type display name
function getLoanTypeName(loan: Loan & { loan_group?: LoanGroupBasic | null }): string {
  return loan.loan_group?.name || 'Lån'
}

// Create expenses from loans (interest and amortization)
export function useCreateExpensesFromLoans() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      loans,
      period,
      date,
      mode = 'register',
    }: {
      loans: LoanWithGroup[]
      period: string
      date: string
      /** 'calculate' = only amortize balances + recompute; 'register' = also create expense transactions */
      mode?: 'calculate' | 'register'
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get user's categories
      const { data: categoriesData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)

      if (catError) throw catError
      const categories = categoriesData as Category[] | null

      // Find or create "Ränta bolån" category
      let interestCategory = categories?.find(c => c.name === 'Ränta bolån')
      if (!interestCategory) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newCat, error: createError } = await (supabase.from('categories') as any)
          .insert({
            user_id: user.id,
            name: 'Ränta bolån',
            cost_type: 'Fixed',
            subcategory: 'Housing',
            is_default: false,
          })
          .select()
          .single()
        if (createError) throw createError
        interestCategory = newCat
      }

      // Find or create "Amortering" category
      let amortizationCategory = categories?.find(c => c.name === 'Amortering')
      if (!amortizationCategory) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newCat, error: createError } = await (supabase.from('categories') as any)
          .insert({
            user_id: user.id,
            name: 'Amortering',
            cost_type: 'Fixed',
            subcategory: 'Loans',
            is_default: false,
          })
          .select()
          .single()
        if (createError) throw createError
        amortizationCategory = newCat
      }

      // Calculate proper end of month date for the period
      const [year, month] = period.split('-').map(Number)
      const lastDayOfMonth = new Date(year, month, 0).getDate()
      const periodEndDate = `${period}-${lastDayOfMonth.toString().padStart(2, '0')}`

      // Check for existing loan expenses in this period to prevent duplicates.
      // We match against the loan categories so CSV-imported interest/amortization
      // rows (which carry the Ränta/Amortering category) are caught too.
      const { data: existingExpensesData, error: existingError } = await supabase
        .from('expenses')
        .select('id, description, category_id, amount')
        .eq('user_id', user.id)
        .gte('date', `${period}-01`)
        .lte('date', periodEndDate)
        .in('category_id', [interestCategory?.id, amortizationCategory?.id].filter(Boolean))

      if (existingError) throw existingError
      const existingExpenses = existingExpensesData as Array<{ id: string; description: string; category_id: string; amount: number }> | null

      // An expected loan cost is "already registered" if a matching expense exists
      // in the period — either by exact description, or by category + amount (±5%,
      // min 50 kr) so imported transactions with bank descriptions still match.
      const alreadyRegistered = (categoryId: string | undefined, description: string, expected: number) => {
        if (!categoryId) return false
        const tol = Math.max(50, Math.round(expected * 0.05))
        return existingExpenses?.some(
          e =>
            e.category_id === categoryId &&
            (e.description === description || Math.abs(Number(e.amount) - expected) <= tol)
        ) ?? false
      }

      const periodStart = `${period}-01`

      const expenses: Array<{
        user_id: string
        category_id: string
        amount: number
        description: string
        date: string
        cost_assignment: 'personal' | 'shared' | 'partner'
        is_ccm: boolean
      }> = []

      const loansToUpdate: Array<{ id: string; newBalance: number }> = []

      for (const loan of loans) {
        const loanTypeName = getLoanTypeName(loan)
        const interestDescription = `${loanTypeName} - ${loan.name} (Ränta)`
        const amortizationDescription = `${loanTypeName} - ${loan.name} (Amortering)`

        const monthlyInterest = Math.round(loan.current_balance * (loan.interest_rate / 100 / 12))
        const amortization = loan.monthly_amortization

        // Only create transactions in 'register' mode, and only when not already booked
        if (mode === 'register') {
          if (monthlyInterest > 0 && interestCategory && !alreadyRegistered(interestCategory.id, interestDescription, monthlyInterest)) {
            expenses.push({
              user_id: user.id,
              category_id: interestCategory.id,
              amount: monthlyInterest,
              description: interestDescription,
              date,
              cost_assignment: loan.is_shared ? 'shared' : 'personal',
              is_ccm: false,
            })
          }

          if (amortization > 0 && amortizationCategory && !alreadyRegistered(amortizationCategory.id, amortizationDescription, amortization)) {
            expenses.push({
              user_id: user.id,
              category_id: amortizationCategory.id,
              amount: amortization,
              description: amortizationDescription,
              date,
              cost_assignment: loan.is_shared ? 'shared' : 'personal',
              is_ccm: false,
            })
          }
        }

        // Balance reduction is decoupled from expense creation and guarded by
        // last_amortization_date so it happens exactly once per period — in both
        // modes, and even if the amortization was imported via CSV.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastAmort = (loan as any).last_amortization_date as string | null | undefined
        const alreadyAmortizedThisPeriod = !!lastAmort && lastAmort >= periodStart
        if (amortization > 0 && !alreadyAmortizedThisPeriod) {
          const newBalance = Math.max(0, loan.current_balance - amortization)
          loansToUpdate.push({ id: loan.id, newBalance })
        }
      }

      // Insert expenses (register mode only)
      if (expenses.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase.from('expenses') as any).insert(expenses)
        if (insertError) {
          throw new Error(`Kunde inte skapa utgifter: ${insertError.message}`)
        }
      }

      // Update loan balances
      let loansUpdatedCount = 0
      for (const loanUpdate of loansToUpdate) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: loanUpdateError } = await (supabase.from('loans') as any)
          .update({
            current_balance: loanUpdate.newBalance,
            last_amortization_date: date,
          })
          .eq('id', loanUpdate.id)

        if (loanUpdateError) {
          console.error(`Failed to update loan ${loanUpdate.id}:`, loanUpdateError)
        } else {
          loansUpdatedCount++
        }
      }

      if (mode === 'calculate') {
        return {
          created: 0,
          skipped: 0,
          loansUpdated: loansUpdatedCount,
          message: loansUpdatedCount > 0
            ? `${loansUpdatedCount} lån omberäknade`
            : 'Inget att omberäkna — redan gjort för perioden',
        }
      }

      if (expenses.length === 0) {
        return {
          created: 0,
          skipped: loans.length * 2,
          loansUpdated: loansUpdatedCount,
          message: 'Alla utgifter finns redan för denna period',
        }
      }

      return {
        created: expenses.length,
        skipped: (loans.length * 2) - expenses.length,
        loansUpdated: loansUpdatedCount,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
