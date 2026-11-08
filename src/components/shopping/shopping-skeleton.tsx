function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary ${className ?? ''}`} />
}

export function ShoppingPageSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-4 max-w-3xl mx-auto">
      <div className="bg-card rounded-3xl p-3 md:p-5 space-y-3">
        <div className="flex gap-2">
          <Pulse className="h-11 flex-1" />
          <Pulse className="h-11 w-[8.75rem]" />
          <Pulse className="h-11 w-11" />
        </div>
        <Pulse className="h-4 w-56" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-card rounded-3xl p-4 space-y-3">
          <Pulse className="h-5 w-40" />
          <Pulse className="h-3 w-28" />
          <Pulse className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}
