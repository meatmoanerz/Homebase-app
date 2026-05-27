/**
 * Resolves a cost_assignment enum value to a human-readable display label.
 *
 * Database always stores: 'personal' | 'shared' | 'partner'
 * UI always shows: the actual first names of the people involved.
 *
 * Example:
 *   Tim is logged in, partner is Amanda.
 *   - 'personal' → 'Tim'
 *   - 'partner'  → 'Amanda'
 *   - 'shared'   → 'Delad' (or translated equivalent)
 *
 *   Amanda logs in:
 *   - 'personal' → 'Amanda'
 *   - 'partner'  → 'Tim'
 *   - 'shared'   → 'Delad'
 *
 * This means the pill on an ICA expense always shows the correct name
 * regardless of who is viewing it.
 */

export type CostAssignment = "personal" | "shared" | "partner"

export interface AssignmentLabelOptions {
  /** The currently logged-in user's profile */
  me: { first_name: string }
  /** The partner's profile, if connected */
  partner: { first_name: string } | null
  /** Translated label for 'shared'. Defaults to 'Delad'. */
  sharedLabel?: string
}

export function resolveAssignmentLabel(
  assignment: CostAssignment,
  { me, partner, sharedLabel = "Delad" }: AssignmentLabelOptions
): string {
  switch (assignment) {
    case "personal":
      return me.first_name
    case "partner":
      return partner?.first_name ?? sharedLabel
    case "shared":
      return sharedLabel
  }
}

/**
 * Returns the Tailwind color tokens for a given assignment.
 * Used to color pills consistently.
 */
export function resolveAssignmentColors(
  assignment: CostAssignment,
  me: { first_name: string },
  partner: { first_name: string } | null
): {
  bg: string
  text: string
} {
  if (assignment === "shared") {
    return { bg: "bg-secondary", text: "text-muted-foreground" }
  }
  if (assignment === "personal") {
    // Could be Tim or Amanda depending on who's logged in — use their color
    return { bg: "bg-hb-tim-soft", text: "text-hb-tim" }
  }
  if (assignment === "partner") {
    return { bg: "bg-hb-amanda-soft", text: "text-hb-amanda" }
  }
  return { bg: "bg-secondary", text: "text-muted-foreground" }
}

/**
 * Resolves colors based on whose name it is, not the assignment enum.
 * More reliable when we know the actual person (e.g. from group purchase splits).
 *
 * Pass in the profile names for Tim and Amanda from settings/partner connection.
 * Whoever is "user1" gets tim-colors, whoever is "user2" gets amanda-colors —
 * this is determined by partner_connections.user1_id ordering.
 */
export function resolvePersonColors(firstName: string, knownNames: {
  user1: string
  user2: string | null
}): { bg: string; text: string } {
  if (firstName === knownNames.user1) {
    return { bg: "bg-hb-tim-soft", text: "text-hb-tim" }
  }
  if (firstName === knownNames.user2) {
    return { bg: "bg-hb-amanda-soft", text: "text-hb-amanda" }
  }
  return { bg: "bg-secondary", text: "text-muted-foreground" }
}
