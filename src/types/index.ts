import type { Tables, Enums } from './database'

// Re-export database types
export type Profile = Tables<'profiles'>
export type Category = Tables<'categories'>
export type Income = Tables<'incomes'>
export type MonthlyIncome = Tables<'monthly_incomes'>
export type Budget = Tables<'budgets'>
export type BudgetItem = Tables<'budget_items'>
export type BudgetItemAssignment = Tables<'budget_item_assignments'>
export type Expense = Tables<'expenses'>
export type RecurringExpense = Tables<'recurring_expenses'>
export type Loan = Tables<'loans'>
export type LoanGroup = Tables<'loan_groups'>
export type LoanInterestHistory = Tables<'loan_interest_history'>
export type SavingsGoal = Tables<'savings_goals'>
export type SavingsGoalContribution = Tables<'savings_goal_contributions'>
export type CustomGoalType = Tables<'custom_goal_types'>
export type PartnerConnection = Tables<'partner_connections'>
export type StatementAnalysis = Tables<'statement_analyses'>
export type StatementTransaction = Tables<'statement_transactions'>
export type TemporaryBudget = Tables<'temporary_budgets'>
export type TemporaryBudgetCategory = Tables<'temporary_budget_categories'>

// Enum types
export type CostType = Enums<'cost_type'>
export type SubcategoryType = Enums<'subcategory_type'>
export type BudgetItemType = Enums<'budget_item_type'>
export type CostAssignment = Enums<'cost_assignment'>
export type GoalCategory = Enums<'goal_category'>
export type GoalStatus = Enums<'goal_status'>
export type ConnectionStatus = Enums<'connection_status'>
export type AnalysisStatus = Enums<'analysis_status'>
export type TemporaryBudgetStatus = Enums<'temporary_budget_status'>

// Extended types with relations
export interface ExpenseWithCategory extends Expense {
  category: Category | null
}

export interface BudgetItemWithCategory extends BudgetItem {
  category?: Category | null
  budget_item_assignments?: BudgetItemAssignment[]
}

export interface BudgetWithItems extends Budget {
  budget_items: BudgetItemWithCategory[]
}

export interface SavingsGoalWithCategory extends SavingsGoal {
  category: Category | null
  custom_goal_type?: CustomGoalType | null
}

export interface SavingsGoalContributionWithExpense extends SavingsGoalContribution {
  /** null for manual entries (withdrawals) */
  expense: Expense | null
}

export interface LoanWithGroup extends Loan {
  loan_group: LoanGroup | null
}

export interface TemporaryBudgetWithCategories extends TemporaryBudget {
  temporary_budget_categories: TemporaryBudgetCategory[]
}

export interface TemporaryBudgetWithDetails extends TemporaryBudgetWithCategories {
  expenses: ExpenseWithCategory[]
}

// Budget period type
export interface BudgetPeriod {
  period: string // YYYY-MM format
  startDate: Date
  endDate: Date
  displayName: string
}

// Monthly income with household context
export interface HouseholdMonthlyIncome {
  id: string
  user_id: string
  period: string
  name: string
  amount: number
  is_own: boolean
  owner_name: string
  created_at: string
}

// User with partner
export interface UserWithPartner extends Profile {
  partner?: Profile | null
  partnerConnection?: PartnerConnection | null
}

// Navigation item
export interface NavItem {
  href: string
  label: string
  icon: string
  badge?: number
}

