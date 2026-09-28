'use client'

import { cn } from '@/lib/utils/cn'
import { useUser, usePartner } from '@/hooks/use-user'
import type { CostAssignment } from '@/lib/utils/assignment-label'
import { useCreditCards } from '@/hooks/use-credit-cards'
import { getDefaultCard } from '@/lib/utils/credit-cards'

interface AssignmentPillProps {
  assignment: CostAssignment | null | undefined
  className?: string
  /** Override the "shared" label (defaults to "Delad") */
  sharedLabel?: string
  /** For group purchases with custom split, pass the split text e.g. "109/259" */
  customSplitLabel?: string
}

/**
 * Renders a pill showing who pays for an expense.
 *
 * Always uses the logged-in user's perspective:
 * - 'personal' → current user's first name (Tim-blue if owner is user1)
 * - 'partner'  → partner's first name (Amanda-terracotta)
 * - 'shared'   → "Delad" (neutral grey)
 *
 * Same expense looks different to Tim vs Amanda — both see correct names.
 */
export function AssignmentPill({
  assignment,
  className,
  sharedLabel = 'Delad',
  customSplitLabel,
}: AssignmentPillProps) {
  const { data: user } = useUser()
  const { data: partner } = usePartner()

  if (!assignment) {
    return null
  }

  let label: string
  let colorClass: string

  if (customSplitLabel) {
    label = customSplitLabel
    colorClass = 'bg-secondary text-muted-foreground'
  } else if (assignment === 'shared') {
    label = sharedLabel
    colorClass = 'bg-secondary text-muted-foreground'
  } else if (assignment === 'personal') {
    label = user?.first_name || 'Du'
    colorClass = 'bg-hb-tim-soft text-hb-tim'
  } else {
    // partner
    label = partner?.first_name || 'Partner'
    colorClass = 'bg-hb-amanda-soft text-hb-amanda'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide',
        colorClass,
        className
      )}
    >
      {label}
    </span>
  )
}

/**
 * Variant used for Amex-marked expenses.
 */
export function AmexPill({ className, label = 'Amex' }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide',
        'bg-hb-cognac/15 text-hb-cognac-deep',
        className
      )}
    >
      {label}
    </span>
  )
}

/**
 * Kreditkortsetikett för CCM-utgifter — visar kortets namn (t.ex. "Amex",
 * "Norwegian"). Faller tillbaka på standardkortet om utgiften saknar kort.
 */
export function CreditCardPill({ cardId, className }: { cardId: string | null | undefined; className?: string }) {
  const { data: cards = [] } = useCreditCards()
  const card = cards.find(c => c.id === cardId) ?? getDefaultCard(cards)
  return <AmexPill className={className} label={card?.name || 'Kort'} />
}
