function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary ${className ?? ''}`} />
}

export function MealsPageSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-4 max-w-3xl mx-auto">
      <div className="bg-card border border-border rounded-3xl p-5 space-y-3">
        <Pulse className="h-4 w-40" />
        <Pulse className="h-9 w-full rounded-full" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-3xl p-5 space-y-3">
          <div className="flex justify-between">
            <Pulse className="h-6 w-20" />
            <Pulse className="h-6 w-24" />
          </div>
          <Pulse className="h-3 w-48" />
          <Pulse className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}
