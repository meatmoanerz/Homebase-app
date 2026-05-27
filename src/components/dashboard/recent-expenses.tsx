'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatRelativeDate } from '@/lib/utils/formatters'
import { ChevronRight, Receipt, Users, UserCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type { ExpenseWithCategory } from '@/types'

interface RecentExpensesProps {
  expenses: ExpenseWithCategory[]
}

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
}

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  if (expenses.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Senaste utgifterna</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-hb-sage/30 flex items-center justify-center mb-3">
              <Receipt className="w-6 h-6 text-hb-cognac" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Inga utgifter ännu denna period
            </p>
            <Button asChild size="sm">
              <Link href="/expenses">Lägg till utgift</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Senaste utgifterna</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/expenses/list" className="text-xs">
              Visa alla
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {expenses.map((expense, index) => (
          <motion.div
            key={expense.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-hb-sage/20 flex items-center justify-center text-lg">
                {categoryIcons[expense.category?.name ?? ''] || '💰'}
              </div>
              <div>
                <p className="font-medium text-sm">{expense.description}</p>
                <p className="text-xs text-muted-foreground">
                  {expense.category?.name} • {formatRelativeDate(expense.date)}
                </p>
              </div>
            </div>
            <div className="text-right flex items-center gap-2">
              {/* Cost assignment indicator */}
              {expense.cost_assignment === 'shared' && (
                <div className="w-5 h-5 rounded-full bg-hb-tim/20 flex items-center justify-center" title="Delad utgift">
                  <Users className="w-3 h-3 text-hb-tim" />
                </div>
              )}
              {expense.cost_assignment === 'partner' && (
                <div className="w-5 h-5 rounded-full bg-hb-terracotta/20 flex items-center justify-center" title="Partnerns utgift">
                  <UserCheck className="w-3 h-3 text-hb-terracotta" />
                </div>
              )}
              <div>
                <p className={cn(
                  "font-semibold",
                  expense.is_ccm ? "text-hb-tim" : "text-foreground"
                )}>
                  -{formatCurrency(expense.amount)}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  )
}

