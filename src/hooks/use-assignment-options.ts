'use client'

import { useMemo } from 'react'
import { useUser, usePartner } from '@/hooks/use-user'
import { resolveAssignmentLabel, type CostAssignment } from '@/lib/utils/assignment-label'

export interface AssignmentOption {
  value: CostAssignment
  label: string
}

/**
 * Returns the cost-assignment options for select dropdowns, with the
 * actual person names resolved:
 *   - 'personal' → logged-in user's first name
 *   - 'shared'   → 'Delad'
 *   - 'partner'  → partner's first name (omitted if no partner connected)
 *
 * Use everywhere a cost_assignment <select> is rendered so the wording
 * is consistent across the app.
 */
export function useAssignmentOptions(sharedLabel = 'Delad'): AssignmentOption[] {
  const { data: user } = useUser()
  const { data: partner } = usePartner()

  return useMemo(() => {
    const me = { first_name: user?.first_name || 'Du' }
    const partnerProfile = partner ? { first_name: partner.first_name } : null

    const options: AssignmentOption[] = [
      {
        value: 'personal',
        label: resolveAssignmentLabel('personal', { me, partner: partnerProfile, sharedLabel }),
      },
      {
        value: 'shared',
        label: resolveAssignmentLabel('shared', { me, partner: partnerProfile, sharedLabel }),
      },
    ]

    // Only show partner option if a partner is connected
    if (partnerProfile) {
      options.push({
        value: 'partner',
        label: resolveAssignmentLabel('partner', { me, partner: partnerProfile, sharedLabel }),
      })
    }

    return options
  }, [user?.first_name, partner, sharedLabel])
}

/**
 * Convenience helper returning a single resolved label for one assignment value.
 */
export function useAssignmentLabel(assignment: CostAssignment | null | undefined, sharedLabel = 'Delad'): string {
  const { data: user } = useUser()
  const { data: partner } = usePartner()

  return useMemo(() => {
    if (!assignment) return ''
    const me = { first_name: user?.first_name || 'Du' }
    const partnerProfile = partner ? { first_name: partner.first_name } : null
    return resolveAssignmentLabel(assignment, { me, partner: partnerProfile, sharedLabel })
  }, [assignment, user?.first_name, partner, sharedLabel])
}
