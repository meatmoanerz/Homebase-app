'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Activity,
  Receipt,
  Heart,
  CreditCard,
  TrendingUp,
  CheckCircle,
} from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { KPICard } from '@/components/admin/kpi-card'
import { cn } from '@/lib/utils/cn'

interface Stats {
  totalUsers: number
  newUsers: number
  activeUsers: number
  totalExpenses: number
  partnerConnections: number
  ccmEnabledUsers: number
  avgExpensesPerUser: number
  onboardingRate: number
  activityChart: Array<{ date: string; expenses: number; amount: number }>
  period: string
}

const periods = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '12m', label: '12 Months' },
]

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/admin/stats?period=${period}`)
        if (!response.ok) {
          throw new Error('Failed to fetch stats')
        }
        const data = await response.json()
        setStats(data)
      } catch (err) {
        setError('Failed to load statistics')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [period])

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Overview of Homebase application metrics
            </p>
          </div>

          {/* Period selector */}
          <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  period === p.value
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Users"
            value={stats?.totalUsers || 0}
            icon={Users}
            loading={loading}
            description="All registered users"
          />
          <KPICard
            title="New Users"
            value={stats?.newUsers || 0}
            icon={UserPlus}
            loading={loading}
            description={`In selected period`}
          />
          <KPICard
            title="Active Users"
            value={stats?.activeUsers || 0}
            icon={Activity}
            loading={loading}
            description="Active in last 30 days"
          />
          <KPICard
            title="Total Expenses"
            value={stats?.totalExpenses || 0}
            icon={Receipt}
            loading={loading}
            description={`In selected period`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Partner Connections"
            value={stats?.partnerConnections || 0}
            icon={Heart}
            loading={loading}
            description="Active connections"
          />
          <KPICard
            title="CCM Users"
            value={stats?.ccmEnabledUsers || 0}
            icon={CreditCard}
            loading={loading}
            description="Credit Card Manager enabled"
          />
          <KPICard
            title="Avg Expenses/User"
            value={stats?.avgExpensesPerUser || 0}
            icon={TrendingUp}
            loading={loading}
            description={`In selected period`}
          />
          <KPICard
            title="Onboarding Rate"
            value={`${stats?.onboardingRate || 0}%`}
            icon={CheckCircle}
            loading={loading}
            description="Completed onboarding"
          />
        </div>

        {/* Activity Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">
            Activity Over Time
          </h2>
          {loading ? (
            <div className="h-64 bg-slate-700 rounded animate-pulse" />
          ) : stats?.activityChart && stats.activityChart.length > 0 ? (
            <div className="h-64 relative">
              <ActivityChart data={stats.activityChart} />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              No activity data for selected period
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}

// Simple bar chart component
function ActivityChart({ data }: { data: Array<{ date: string; expenses: number; amount: number }> }) {
  const maxExpenses = Math.max(...data.map((d) => d.expenses), 1)

  return (
    <div className="h-full flex items-end gap-1 overflow-x-auto pb-8 pt-4">
      {data.map((item, index) => {
        const height = (item.expenses / maxExpenses) * 100
        return (
          <div
            key={index}
            className="flex-1 min-w-[20px] max-w-[40px] flex flex-col items-center group"
          >
            <div className="relative flex-1 w-full flex items-end">
              <div
                className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-t transition-all cursor-pointer"
                style={{ height: `${Math.max(height, 2)}%` }}
              >
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {item.expenses} expenses
                  <br />
                  {new Date(item.date).toLocaleDateString('sv-SE')}
                </div>
              </div>
            </div>
            {data.length <= 14 && (
              <div className="text-[10px] text-slate-500 mt-2 rotate-45 origin-left whitespace-nowrap">
                {new Date(item.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
