import { cn } from '@/lib/utils/cn'

interface SkeletonProps {
  className?: string
}

/**
 * Base Skeleton component with pulse animation
 * Uses Homebase color palette (sage/20 for subtle loading effect)
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-hb-sage/20',
        className
      )}
    />
  )
}

/**
 * Skeleton for KPI cards on dashboard
 * Matches the height and structure of actual KPI cards
 */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border-0 shadow-sm bg-card p-4 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
    </div>
  )
}

/**
 * Skeleton for progress bars (budget overview)
 */
export function SkeletonProgress() {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

/**
 * Skeleton for list items (expenses, transactions)
 */
interface SkeletonListItemProps {
  withIcon?: boolean
}

export function SkeletonListItem({ withIcon = false }: SkeletonListItemProps) {
  return (
    <div className="flex items-center gap-3 p-3">
      {withIcon && <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  )
}

/**
 * Skeleton list with multiple items
 */
interface SkeletonListProps {
  count?: number
  withIcon?: boolean
}

export function SkeletonList({ count = 5, withIcon = false }: SkeletonListProps) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} withIcon={withIcon} />
      ))}
    </div>
  )
}

/**
 * Skeleton for circular chart (pie/donut)
 */
export function SkeletonChart() {
  return (
    <div className="flex items-center justify-center p-6">
      <Skeleton className="h-48 w-48 rounded-full" />
    </div>
  )
}

/**
 * Skeleton for text blocks
 */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}
