'use client'

import { useUser, usePartner } from '@/hooks/use-user'
import { usePerspective, type Perspective } from '@/hooks/use-perspective'
import { cn } from '@/lib/utils/cn'

/**
 * Inline Alla / Du / Partner switch bound to the global perspective store, so
 * the choice made here and in the header stays in sync across the app.
 * Renders nothing without a connected partner.
 */
export function PerspectiveSwitch({ className }: { className?: string }) {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { perspective, setPerspective } = usePerspective()

  if (!partner) return null

  const options: Array<{ value: Perspective; label: string; activeClass: string }> = [
    { value: 'all', label: 'Alla', activeClass: 'bg-card text-foreground shadow-sm' },
    { value: 'me', label: user?.first_name || 'Du', activeClass: 'bg-hb-tim-soft text-hb-tim shadow-sm' },
    { value: 'partner', label: partner.first_name || 'Partner', activeClass: 'bg-hb-amanda-soft text-hb-amanda shadow-sm' },
  ]

  return (
    <div role="radiogroup" aria-label="Visar för" className={cn('flex gap-1 bg-secondary rounded-full p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={perspective === o.value}
          onClick={() => setPerspective(o.value)}
          className={cn(
            'flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
            perspective === o.value ? o.activeClass : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
