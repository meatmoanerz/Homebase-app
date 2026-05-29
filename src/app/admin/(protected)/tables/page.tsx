'use client'

import Link from 'next/link'
import {
  User,
  Heart,
  Folder,
  Wallet,
  CalendarDays,
  PiggyBank,
  Receipt,
  RefreshCw,
  Building2,
  CreditCard,
  TrendingUp,
  Target,
  Gift,
  FileText,
  ArrowUpDown,
  ChevronRight,
} from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { cn } from '@/lib/utils/cn'

interface TableInfo {
  name: string
  displayName: string
  description: string
  icon: React.ElementType
  priority: 'high' | 'medium' | 'low'
}

const tables: TableInfo[] = [
  {
    name: 'profiles',
    displayName: 'Profiles',
    description: 'User accounts and settings',
    icon: User,
    priority: 'high',
  },
  {
    name: 'expenses',
    displayName: 'Expenses',
    description: 'Transaction records',
    icon: Receipt,
    priority: 'high',
  },
  {
    name: 'categories',
    displayName: 'Categories',
    description: 'Expense/income categories',
    icon: Folder,
    priority: 'high',
  },
  {
    name: 'budgets',
    displayName: 'Budgets',
    description: 'Monthly budget overview',
    icon: Wallet,
    priority: 'high',
  },
  {
    name: 'budget_items',
    displayName: 'Budget Items',
    description: 'Individual budget line items',
    icon: ArrowUpDown,
    priority: 'medium',
  },
  {
    name: 'incomes',
    displayName: 'Incomes',
    description: 'User income sources',
    icon: TrendingUp,
    priority: 'medium',
  },
  {
    name: 'monthly_incomes',
    displayName: 'Monthly Incomes',
    description: 'Period-specific income tracking',
    icon: CalendarDays,
    priority: 'medium',
  },
  {
    name: 'recurring_expenses',
    displayName: 'Recurring Expenses',
    description: 'Recurring payment setup',
    icon: RefreshCw,
    priority: 'medium',
  },
  {
    name: 'partner_connections',
    displayName: 'Partner Connections',
    description: 'Partner linking for shared budgets',
    icon: Heart,
    priority: 'medium',
  },
  {
    name: 'savings_goals',
    displayName: 'Savings Goals',
    description: 'Savings targets',
    icon: Target,
    priority: 'medium',
  },
  {
    name: 'savings_goal_contributions',
    displayName: 'Savings Contributions',
    description: 'Contributions to savings goals',
    icon: Gift,
    priority: 'low',
  },
  {
    name: 'loans',
    displayName: 'Loans',
    description: 'Debt tracking',
    icon: Building2,
    priority: 'medium',
  },
  {
    name: 'loan_groups',
    displayName: 'Loan Groups',
    description: 'Loan organization',
    icon: PiggyBank,
    priority: 'low',
  },
  {
    name: 'loan_interest_history',
    displayName: 'Loan Interest History',
    description: 'Interest rate changes',
    icon: TrendingUp,
    priority: 'low',
  },
  {
    name: 'receipts',
    displayName: 'Receipts',
    description: 'Grocery receipts',
    icon: FileText,
    priority: 'low',
  },
  {
    name: 'receipt_items',
    displayName: 'Receipt Items',
    description: 'Line items from receipts',
    icon: CreditCard,
    priority: 'low',
  },
  {
    name: 'category_mappings',
    displayName: 'Category Mappings',
    description: 'Auto-categorization rules',
    icon: CreditCard,
    priority: 'low',
  },
  {
    name: 'custom_goal_types',
    displayName: 'Custom Goal Types',
    description: 'User-defined goal types',
    icon: Target,
    priority: 'low',
  },
  {
    name: 'budget_item_assignments',
    displayName: 'Budget Item Assignments',
    description: 'Budget item user assignments',
    icon: ArrowUpDown,
    priority: 'low',
  },
]

export default function AdminTablesPage() {
  const highPriority = tables.filter((t) => t.priority === 'high')
  const mediumPriority = tables.filter((t) => t.priority === 'medium')
  const lowPriority = tables.filter((t) => t.priority === 'low')

  return (
    <AdminShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Database Tables</h1>
          <p className="text-slate-400 mt-1">
            Manage and inspect database records
          </p>
        </div>

        {/* High priority tables */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Primary Tables
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {highPriority.map((table) => (
              <TableCard key={table.name} table={table} />
            ))}
          </div>
        </section>

        {/* Medium priority tables */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full" />
            Secondary Tables
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mediumPriority.map((table) => (
              <TableCard key={table.name} table={table} />
            ))}
          </div>
        </section>

        {/* Low priority tables */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-slate-500 rounded-full" />
            Supporting Tables
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowPriority.map((table) => (
              <TableCard key={table.name} table={table} />
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  )
}

function TableCard({ table }: { table: TableInfo }) {
  return (
    <Link
      href={`/admin/tables/${table.name}`}
      className={cn(
        'block bg-slate-800 rounded-xl border border-slate-700 p-5',
        'hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all group'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-700 rounded-lg group-hover:bg-emerald-600/20 transition-colors">
            <table.icon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-medium text-white group-hover:text-emerald-400 transition-colors">
              {table.displayName}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">{table.description}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
      </div>
    </Link>
  )
}
