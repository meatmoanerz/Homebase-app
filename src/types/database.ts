export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          avatar_url: string | null
          salary_day: number
          onboarding_completed: boolean
          currency: string
          language: string
          theme: string
          ccm_enabled: boolean
          ccm_invoice_break_date: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name: string
          last_name?: string
          avatar_url?: string | null
          salary_day?: number
          onboarding_completed?: boolean
          currency?: string
          language?: string
          theme?: string
          ccm_enabled?: boolean
          ccm_invoice_break_date?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          avatar_url?: string | null
          salary_day?: number
          onboarding_completed?: boolean
          currency?: string
          language?: string
          theme?: string
          ccm_enabled?: boolean
          ccm_invoice_break_date?: number
          created_at?: string
          updated_at?: string
        }
      }
      partner_connections: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          status: 'pending' | 'active' | 'rejected' | 'revoked'
          initiated_by: string
          invite_code: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          status?: 'pending' | 'active' | 'rejected' | 'revoked'
          initiated_by: string
          invite_code?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user1_id?: string
          user2_id?: string
          status?: 'pending' | 'active' | 'rejected' | 'revoked'
          initiated_by?: string
          invite_code?: string | null
          expires_at?: string | null
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          cost_type: 'Fixed' | 'Variable' | 'Savings'
          subcategory: 'Home' | 'Housing' | 'Transport' | 'Entertainment' | 'Loans' | 'Savings' | 'Other'
          default_value: number
          is_default: boolean
          is_shared_expense: boolean
          shared_with: string | null
          linked_savings_goal_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          cost_type: 'Fixed' | 'Variable' | 'Savings'
          subcategory: 'Home' | 'Housing' | 'Transport' | 'Entertainment' | 'Loans' | 'Savings' | 'Other'
          default_value?: number
          is_default?: boolean
          is_shared_expense?: boolean
          shared_with?: string | null
          linked_savings_goal_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          cost_type?: 'Fixed' | 'Variable' | 'Savings'
          subcategory?: 'Home' | 'Housing' | 'Transport' | 'Entertainment' | 'Loans' | 'Savings' | 'Other'
          default_value?: number
          is_default?: boolean
          is_shared_expense?: boolean
          shared_with?: string | null
          linked_savings_goal_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      custom_goal_types: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string
          color?: string
          created_at?: string
        }
      }
      incomes: {
        Row: {
          id: string
          user_id: string
          name: string
          amount: number
          is_shared: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          amount: number
          is_shared?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          amount?: number
          is_shared?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      monthly_incomes: {
        Row: {
          id: string
          user_id: string
          period: string
          name: string
          amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period: string
          name: string
          amount: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          period?: string
          name?: string
          amount?: number
          created_at?: string
          updated_at?: string
        }
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          partner_id: string | null
          period: string
          version: string
          total_income: number
          total_expenses: number
          total_cashflow_expenses: number
          total_ccm_expenses: number
          total_savings: number
          net_balance: number
          savings_ratio: number
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          partner_id?: string | null
          period: string
          version?: string
          total_income?: number
          total_expenses?: number
          total_cashflow_expenses?: number
          total_ccm_expenses?: number
          total_savings?: number
          net_balance?: number
          savings_ratio?: number
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          partner_id?: string | null
          period?: string
          version?: string
          total_income?: number
          total_expenses?: number
          total_cashflow_expenses?: number
          total_ccm_expenses?: number
          total_savings?: number
          net_balance?: number
          savings_ratio?: number
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      budget_items: {
        Row: {
          id: string
          budget_id: string
          category_id: string | null
          name: string
          type: 'income' | 'fixedExpense' | 'variableExpense' | 'savings'
          amount: number
          is_ccm: boolean
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          category_id?: string | null
          name: string
          type: 'income' | 'fixedExpense' | 'variableExpense' | 'savings'
          amount?: number
          is_ccm?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          category_id?: string | null
          name?: string
          type?: 'income' | 'fixedExpense' | 'variableExpense' | 'savings'
          amount?: number
          is_ccm?: boolean
          created_at?: string
        }
      }
      budget_item_assignments: {
        Row: {
          id: string
          budget_item_id: string
          user_id: string
          amount: number
        }
        Insert: {
          id?: string
          budget_item_id: string
          user_id: string
          amount?: number
        }
        Update: {
          id?: string
          budget_item_id?: string
          user_id?: string
          amount?: number
        }
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          amount: number
          description: string
          date: string
          cost_assignment: 'shared' | 'personal' | 'partner'
          assigned_to: string | null
          is_recurring: boolean
          recurring_expense_id: string | null
          is_ccm: boolean
          is_group_purchase: boolean
          group_purchase_total: number | null
          group_purchase_user_share: number | null
          group_purchase_partner_share: number | null
          group_purchase_swish_amount: number | null
          group_purchase_swish_recipient: 'user' | 'partner' | 'shared' | null
          temporary_budget_id: string | null
          temporary_budget_category_id: string | null
          original_currency: string | null
          original_amount: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          amount: number
          description: string
          date?: string
          cost_assignment?: 'shared' | 'personal' | 'partner'
          assigned_to?: string | null
          is_recurring?: boolean
          recurring_expense_id?: string | null
          is_ccm?: boolean
          is_group_purchase?: boolean
          group_purchase_total?: number | null
          group_purchase_user_share?: number | null
          group_purchase_partner_share?: number | null
          group_purchase_swish_amount?: number | null
          group_purchase_swish_recipient?: 'user' | 'partner' | 'shared' | null
          temporary_budget_id?: string | null
          temporary_budget_category_id?: string | null
          original_currency?: string | null
          original_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string | null
          amount?: number
          description?: string
          date?: string
          cost_assignment?: 'shared' | 'personal' | 'partner'
          assigned_to?: string | null
          is_recurring?: boolean
          recurring_expense_id?: string | null
          is_ccm?: boolean
          is_group_purchase?: boolean
          group_purchase_total?: number | null
          group_purchase_user_share?: number | null
          group_purchase_partner_share?: number | null
          group_purchase_swish_amount?: number | null
          group_purchase_swish_recipient?: 'user' | 'partner' | 'shared' | null
          temporary_budget_id?: string | null
          temporary_budget_category_id?: string | null
          original_currency?: string | null
          original_amount?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      recurring_expenses: {
        Row: {
          id: string
          user_id: string
          category_id: string
          description: string
          amount: number
          day_of_month: number
          cost_assignment: 'shared' | 'personal' | 'partner'
          assigned_to: string | null
          is_ccm: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          description: string
          amount: number
          day_of_month?: number
          cost_assignment?: 'shared' | 'personal' | 'partner'
          assigned_to?: string | null
          is_ccm?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          description?: string
          amount?: number
          day_of_month?: number
          cost_assignment?: 'shared' | 'personal' | 'partner'
          assigned_to?: string | null
          is_ccm?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      loan_groups: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string
        }
      }
      loans: {
        Row: {
          id: string
          user_id: string
          group_id: string | null
          name: string
          original_amount: number
          current_balance: number
          interest_rate: number
          monthly_amortization: number
          last_amortization_date: string | null
          is_shared: boolean
          include_in_budget: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          group_id?: string | null
          name: string
          original_amount: number
          current_balance: number
          interest_rate: number
          monthly_amortization?: number
          last_amortization_date?: string | null
          is_shared?: boolean
          include_in_budget?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          group_id?: string | null
          name?: string
          original_amount?: number
          current_balance?: number
          interest_rate?: number
          monthly_amortization?: number
          last_amortization_date?: string | null
          is_shared?: boolean
          include_in_budget?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      loan_interest_history: {
        Row: {
          id: string
          loan_id: string
          rate: number
          effective_date: string
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          rate: number
          effective_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          rate?: number
          effective_date?: string
          created_at?: string
        }
      }
      savings_goals: {
        Row: {
          id: string
          user_id: string
          category_id: string
          partner_id: string | null
          name: string
          description: string | null
          target_amount: number | null
          target_date: string | null
          starting_balance: number
          starting_balance_user1: number
          starting_balance_user2: number
          monthly_savings_enabled: boolean
          monthly_savings_amount: number
          recurring_expense_id: string | null
          goal_category: 'emergency' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'other'
          custom_goal_type_id: string | null
          status: 'active' | 'completed' | 'archived'
          is_shared: boolean
          completed_at: string | null
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          partner_id?: string | null
          name: string
          description?: string | null
          target_amount?: number | null
          target_date?: string | null
          starting_balance?: number
          starting_balance_user1?: number
          starting_balance_user2?: number
          monthly_savings_enabled?: boolean
          monthly_savings_amount?: number
          recurring_expense_id?: string | null
          goal_category?: 'emergency' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'other'
          custom_goal_type_id?: string | null
          status?: 'active' | 'completed' | 'archived'
          is_shared?: boolean
          completed_at?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          partner_id?: string | null
          name?: string
          description?: string | null
          target_amount?: number | null
          target_date?: string | null
          starting_balance?: number
          starting_balance_user1?: number
          starting_balance_user2?: number
          monthly_savings_enabled?: boolean
          monthly_savings_amount?: number
          recurring_expense_id?: string | null
          goal_category?: 'emergency' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'other'
          custom_goal_type_id?: string | null
          status?: 'active' | 'completed' | 'archived'
          is_shared?: boolean
          completed_at?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      savings_goal_contributions: {
        Row: {
          id: string
          savings_goal_id: string
          expense_id: string
          user_id: string
          amount: number
          user1_amount: number
          user2_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          savings_goal_id: string
          expense_id: string
          user_id: string
          amount: number
          user1_amount?: number
          user2_amount?: number
          created_at?: string
        }
        Update: {
          id?: string
          savings_goal_id?: string
          expense_id?: string
          user_id?: string
          amount?: number
          user1_amount?: number
          user2_amount?: number
          created_at?: string
        }
      }
      statement_analyses: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_type: string
          bank_name: string | null
          transaction_count: number
          invoice_total: number | null
          status: 'processing' | 'completed' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_type: string
          bank_name?: string | null
          transaction_count?: number
          invoice_total?: number | null
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_type?: string
          bank_name?: string | null
          transaction_count?: number
          invoice_total?: number | null
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
        }
      }
      statement_transactions: {
        Row: {
          id: string
          analysis_id: string
          date: string
          description: string
          amount: number
          cardholder: string | null
          cost_assignment: 'shared' | 'personal' | 'partner'
          suggested_category_id: string | null
          confirmed_category_id: string | null
          is_expense: boolean
          is_saved: boolean
          expense_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          analysis_id: string
          date: string
          description: string
          amount: number
          cardholder?: string | null
          cost_assignment?: 'shared' | 'personal' | 'partner'
          suggested_category_id?: string | null
          confirmed_category_id?: string | null
          is_expense?: boolean
          is_saved?: boolean
          expense_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          analysis_id?: string
          date?: string
          description?: string
          amount?: number
          cardholder?: string | null
          cost_assignment?: 'shared' | 'personal' | 'partner'
          suggested_category_id?: string | null
          confirmed_category_id?: string | null
          is_expense?: boolean
          is_saved?: boolean
          expense_id?: string | null
          created_at?: string
        }
      }
      temporary_budgets: {
        Row: {
          id: string
          user_id: string
          partner_id: string | null
          name: string
          description: string | null
          total_budget: number
          total_spent: number
          currency: string
          exchange_rate: number
          start_date: string
          end_date: string
          linked_budget_period: string | null
          linked_category_id: string | null
          status: 'active' | 'completed' | 'archived'
          is_shared: boolean
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          partner_id?: string | null
          name: string
          description?: string | null
          total_budget: number
          total_spent?: number
          currency?: string
          exchange_rate?: number
          start_date: string
          end_date: string
          linked_budget_period?: string | null
          linked_category_id?: string | null
          status?: 'active' | 'completed' | 'archived'
          is_shared?: boolean
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          partner_id?: string | null
          name?: string
          description?: string | null
          total_budget?: number
          total_spent?: number
          currency?: string
          exchange_rate?: number
          start_date?: string
          end_date?: string
          linked_budget_period?: string | null
          linked_category_id?: string | null
          status?: 'active' | 'completed' | 'archived'
          is_shared?: boolean
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      temporary_budget_categories: {
        Row: {
          id: string
          temporary_budget_id: string
          name: string
          budgeted_amount: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          temporary_budget_id: string
          name: string
          budgeted_amount?: number
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          temporary_budget_id?: string
          name?: string
          budgeted_amount?: number
          sort_order?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_partner_id: {
        Args: { user_id: string }
        Returns: string | null
      }
      get_household_monthly_incomes: {
        Args: { p_period: string }
        Returns: {
          id: string
          user_id: string
          period: string
          name: string
          amount: number
          is_own: boolean
          owner_name: string
          created_at: string
        }[]
      }
      get_household_monthly_income_total: {
        Args: { p_period: string }
        Returns: {
          total_income: number
          user_income: number
          partner_income: number
        }
      }
      has_income_for_period: {
        Args: { p_period: string }
        Returns: boolean
      }
    }
    Enums: {
      cost_type: 'Fixed' | 'Variable' | 'Savings'
      subcategory_type: 'Home' | 'Housing' | 'Transport' | 'Entertainment' | 'Loans' | 'Savings' | 'Other'
      budget_item_type: 'income' | 'fixedExpense' | 'variableExpense' | 'savings'
      cost_assignment: 'shared' | 'personal' | 'partner'
      goal_category: 'emergency' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'other'
      goal_status: 'active' | 'completed' | 'archived'
      connection_status: 'pending' | 'active' | 'rejected' | 'revoked'
      analysis_status: 'processing' | 'completed' | 'failed'
      temporary_budget_status: 'active' | 'completed' | 'archived'
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

