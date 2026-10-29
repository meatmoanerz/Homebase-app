/**
 * Household economy model — how a couple splits income and shared costs.
 *
 *  budget  Each keeps their income; every cost is split as the budget says
 *          (explicit per-row split, else 50/50).
 *  income  Each keeps their income; categories in incomeCategoryIds are split by
 *          the period's income share, other rows as the budget says.
 *  equal   Income is shared equally: the higher earner transfers half the
 *          difference. Costs are split as the budget says.
 *
 * Pure functions only, so the budget form, Gemensam ekonomi and every per-person
 * budget figure compute the same numbers from the same inputs.
 */

export type HouseholdModel = 'budget' | 'income' | 'equal'

export const HOUSEHOLD_MODEL_LABELS: Record<HouseholdModel, string> = {
  budget: 'Enligt budget',
  income: 'Efter inkomst',
  equal: 'Delad inkomst',
}

export interface HouseholdSettingsRow {
  id: string
  user_id: string
  effective_from: string // budget period 'YYYY-MM'
  category_ids: string[]
  model: HouseholdModel
  excluded_income_names: string[]
  income_category_ids: string[]
  created_at: string
  updated_at: string
}

export interface HouseholdSettings {
  model: HouseholdModel
  /** Categories paid from the shared account */
  categoryIds: Set<string>
  /** Subset of categoryIds split by income share (used by the 'income' model) */
  incomeCategoryIds: Set<string>
  /** Income names that stay private (not part of share or equalization) */
  excludedIncomeNames: Set<string>
  /** Period the active settings were saved for, null when never saved */
  effectiveFrom: string | null
}

/**
 * The settings in force for a period: the latest row with effective_from <= period.
 * When both partners saved for the same period, the most recently updated wins.
 */
export function resolveHouseholdSettings(rows: HouseholdSettingsRow[], period: string): HouseholdSettings {
  const active = rows
    .filter((r) => r.effective_from <= period)
    .sort((a, b) =>
      b.effective_from.localeCompare(a.effective_from) || (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)
    )[0]

  return {
    model: active?.model ?? 'budget',
    categoryIds: new Set(active?.category_ids ?? []),
    incomeCategoryIds: new Set(active?.income_category_ids ?? []),
    excludedIncomeNames: new Set(active?.excluded_income_names ?? []),
    effectiveFrom: active?.effective_from ?? null,
  }
}

export interface IncomeEntry {
  user_id: string
  name: string
  amount: number
}

export interface IncomeSplit {
  /** All registered income for the period */
  userIncome: number
  partnerIncome: number
  /** Income that counts towards the share and equalization */
  userCounted: number
  partnerCounted: number
  /** User's share of the counted household income, 0–1 (0.5 when nothing counts) */
  userShare: number
  /**
   * Whole kronor the user transfers to the partner under 'equal' (negative: the
   * partner transfers to the user). 0 for the other models.
   */
  equalization: number
  /** Money each person has to budget with, after equalization */
  userBucket: number
  partnerBucket: number
  /** False while one of the two has no counted income for the period */
  bothRegistered: boolean
}

export function computeIncomeSplit(
  incomes: IncomeEntry[],
  userId: string | null | undefined,
  partnerId: string | null | undefined,
  settings: Pick<HouseholdSettings, 'model' | 'excludedIncomeNames'>
): IncomeSplit {
  let userIncome = 0
  let partnerIncome = 0
  let userCounted = 0
  let partnerCounted = 0

  for (const income of incomes) {
    const amount = Number(income.amount) || 0
    const counts = !settings.excludedIncomeNames.has(income.name)
    if (income.user_id === userId) {
      userIncome += amount
      if (counts) userCounted += amount
    } else if (income.user_id === partnerId) {
      partnerIncome += amount
      if (counts) partnerCounted += amount
    }
  }

  const counted = userCounted + partnerCounted
  const bothRegistered = !!partnerId && userCounted > 0 && partnerCounted > 0
  const equalization = settings.model === 'equal' && bothRegistered
    ? Math.round((userCounted - partnerCounted) / 2)
    : 0

  return {
    userIncome,
    partnerIncome,
    userCounted,
    partnerCounted,
    userShare: counted > 0 ? userCounted / counted : 0.5,
    equalization,
    userBucket: userIncome - equalization,
    partnerBucket: partnerIncome + equalization,
    bothRegistered,
  }
}

/** How a row is split when nobody set its split by hand. */
export interface SplitRule {
  /** User's share 0–1 applied to categories in incomeCategoryIds */
  userShare: number
  incomeCategoryIds: ReadonlySet<string>
}

/** The split rule for a period, or undefined when every row defaults to 50/50. */
export function splitRuleFor(settings: HouseholdSettings, incomeSplit: Pick<IncomeSplit, 'userShare'>): SplitRule | undefined {
  if (settings.model !== 'income' || settings.incomeCategoryIds.size === 0) return undefined
  return { userShare: incomeSplit.userShare, incomeCategoryIds: settings.incomeCategoryIds }
}

/** Whole-kronor default split of an amount for a category under a rule. */
export function defaultSplit(amount: number, categoryId: string | null | undefined, rule?: SplitRule): { user: number; partner: number; byIncome: boolean } {
  if (rule && categoryId && rule.incomeCategoryIds.has(categoryId)) {
    const user = Math.round(amount * rule.userShare)
    return { user, partner: amount - user, byIncome: true }
  }
  return { user: amount / 2, partner: amount / 2, byIncome: false }
}

/** "52/48" for a user share of 0.521 */
export function formatShare(userShare: number): string {
  const user = Math.round(userShare * 100)
  return `${user}/${100 - user}`
}
