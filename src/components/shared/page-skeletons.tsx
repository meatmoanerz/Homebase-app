import { cn } from '@/lib/utils/cn'

/**
 * Pulse animation for skeleton elements in Homebase sand palette.
 */
function Pulse({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-border/60', className)} />
  )
}

/**
 * Hero card skeleton — matches SpendHero height/shape.
 */
export function HeroSkeleton() {
  return (
    <div className="bg-card border border-border rounded-3xl px-6 py-7 space-y-4">
      <Pulse className="h-3 w-36" />
      <Pulse className="h-12 w-56" />
      <Pulse className="h-1.5 w-full rounded-full" />
      <div className="pt-3 border-t border-dashed border-border flex justify-between">
        <div className="space-y-2">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-6 w-28" />
        </div>
        <div className="space-y-2 items-end">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-6 w-28" />
        </div>
      </div>
    </div>
  )
}

/**
 * 2×2 KPI card grid skeleton.
 */
export function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <Pulse className="h-2.5 w-24" />
          <Pulse className="h-8 w-28" />
          <Pulse className="h-2.5 w-16" />
        </div>
      ))}
    </div>
  )
}

/**
 * A single list-row skeleton inside a rounded card.
 * Matches the hairline-list style used everywhere (expenses, receipts, rules).
 */
export function ListRowSkeleton({ withIcon = true }: { withIcon?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-b-0">
      {withIcon && <Pulse className="w-8 h-8 rounded-lg flex-shrink-0" />}
      <div className="flex-1 space-y-2">
        <Pulse className="h-3.5 w-40" />
        <Pulse className="h-2.5 w-24" />
      </div>
      <Pulse className="h-4 w-16 flex-shrink-0" />
    </div>
  )
}

/**
 * A card containing N list rows.
 */
export function ListCardSkeleton({ rows = 5, withIcon = true }: { rows?: number; withIcon?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <ListRowSkeleton key={i} withIcon={withIcon} />
      ))}
    </div>
  )
}

/**
 * Section header skeleton (serif title + optional action).
 */
export function SectionHeaderSkeleton() {
  return (
    <div className="flex items-baseline justify-between pb-3">
      <Pulse className="h-6 w-32" />
      <Pulse className="h-3 w-10" />
    </div>
  )
}

/**
 * Full dashboard page skeleton.
 */
export function DashboardPageSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 pb-4 space-y-5">
      <HeroSkeleton />
      <KpiGridSkeleton />
      <div>
        <SectionHeaderSkeleton />
        <ListCardSkeleton rows={4} />
      </div>
    </div>
  )
}

/**
 * Budget list page skeleton.
 */
export function BudgetPageSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 pb-4 space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
        <Pulse className="h-3 w-20" />
        <Pulse className="h-10 w-40" />
      </div>
      <SectionHeaderSkeleton />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex justify-between">
            <Pulse className="h-5 w-28" />
            <Pulse className="h-5 w-20" />
          </div>
          <Pulse className="h-1.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Pulse className="h-3 w-16" />
            <Pulse className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Expense list page skeleton.
 */
export function ExpenseListPageSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 pb-4 space-y-4">
      {/* Period strip */}
      <div className="flex items-center justify-between">
        <Pulse className="h-3 w-6 rounded-full" />
        <Pulse className="h-5 w-24" />
        <Pulse className="h-3 w-6 rounded-full" />
      </div>
      {/* Search */}
      <Pulse className="h-11 w-full rounded-xl" />
      {/* Filter pills */}
      <Pulse className="h-10 w-full rounded-full" />
      {/* Date group */}
      <div className="space-y-2">
        <div className="flex justify-between px-1">
          <Pulse className="h-2.5 w-12" />
          <Pulse className="h-2.5 w-16" />
        </div>
        <ListCardSkeleton rows={4} />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between px-1">
          <Pulse className="h-2.5 w-16" />
          <Pulse className="h-2.5 w-12" />
        </div>
        <ListCardSkeleton rows={3} />
      </div>
    </div>
  )
}

/**
 * Receipts page skeleton.
 */
export function ReceiptsPageSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 pb-4 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <Pulse className="h-2.5 w-16" />
            <Pulse className="h-8 w-24" />
            <Pulse className="h-2.5 w-12" />
          </div>
        ))}
      </div>
      <SectionHeaderSkeleton />
      <ListCardSkeleton rows={5} />
      <SectionHeaderSkeleton />
      <Pulse className="h-11 w-full rounded-xl" />
      <ListCardSkeleton rows={6} withIcon={false} />
    </div>
  )
}

/**
 * Generic settings page skeleton.
 */
export function SettingsPageSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 pb-4 space-y-3">
      <Pulse className="h-7 w-40 mb-2" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Pulse className="w-9 h-9 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Pulse className="h-3.5 w-28" />
              <Pulse className="h-2.5 w-40" />
            </div>
          </div>
          <Pulse className="w-4 h-4 rounded flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

/**
 * Generic list settings subpage (mappings, loans, etc).
 */
export function SettingsListPageSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 pb-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Pulse className="w-9 h-9 rounded-full flex-shrink-0" />
        <div className="space-y-2">
          <Pulse className="h-6 w-44" />
          <Pulse className="h-3 w-56" />
        </div>
      </div>
      <Pulse className="h-11 w-full rounded-xl" />
      <ListCardSkeleton rows={8} withIcon={false} />
    </div>
  )
}

/**
 * Generic import page skeleton.
 */
export function ImportPageSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 pb-4 space-y-4 max-w-3xl mx-auto">
      <div className="space-y-2">
        <Pulse className="h-8 w-52" />
        <Pulse className="h-3 w-72" />
      </div>
      <div className="space-y-3">
        <Pulse className="h-32 w-full rounded-2xl" />
        <Pulse className="h-32 w-full rounded-2xl" />
      </div>
      <Pulse className="h-12 w-full rounded-full" />
    </div>
  )
}
