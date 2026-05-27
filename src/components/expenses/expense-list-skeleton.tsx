import { Card, CardContent } from '@/components/ui/card'
import { Skeleton, SkeletonListItem } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'

/**
 * Skeleton for grouped expenses by date
 */
function ExpenseGroupSkeleton({ itemCount = 3 }: { itemCount?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Date header */}
      <Skeleton className="h-4 w-32" />

      {/* Expense items */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0 divide-y">
          {Array.from({ length: itemCount }).map((_, i) => (
            <SkeletonListItem key={i} withIcon />
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Complete Expense List Skeleton
 * Matches the layout of expenses/list/page.tsx
 */
export function ExpenseListSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Header with period navigation */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="text-center">
          <Skeleton className="h-6 w-32 mx-auto mb-1" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>

      {/* Search and Filter */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Summary Card */}
      <Card className="border-0 shadow-sm bg-hb-sand/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Expense Groups (3 groups with varying items) */}
      <div className="space-y-4">
        <ExpenseGroupSkeleton itemCount={4} />
        <ExpenseGroupSkeleton itemCount={3} />
        <ExpenseGroupSkeleton itemCount={2} />
      </div>
    </div>
  )
}
