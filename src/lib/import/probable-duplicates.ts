/**
 * Finds a purchase that is already saved under another name.
 *
 * The Plånbok shortcut saves a card purchase with the merchant name Apple Pay
 * shows ("ICA Kvantum", "Zettle"), while the bank file later has the name the
 * bank uses ("ICA KVANTUM MALL OF SCA SOLNA", "PAYPAL *FUNKY CHICKEN F").
 * The texts rarely share a word, so the match is on what both sources agree
 * on: same bank, same amount to the öre, and dates at most a couple of days
 * apart (the shortcut uses the purchase day, the bank its booking day).
 *
 * Only rows from the *other* source are candidates — a bank file row against
 * shortcut/manual rows, a shortcut row against bank file rows — so two real
 * 49 kr scooter rides from the same bank file are never matched to each other.
 */

export const PROBABLE_DUPLICATE_DAYS = 2

export interface SavedExpenseLite {
  id: string
  date: string
  amount: number
  description: string | null
  bank: string | null
  import_source: string | null
  group_purchase_total: number | null
}

export interface IncomingRow {
  date: string
  amount: number
  bank: string | null
}

function dayNumber(date: string): number {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000)
}

function cents(amount: number): number {
  return Math.round(Math.abs(amount) * 100)
}

/** The amount the card was charged: the full total for an utlägg. */
export function chargedAmount(expense: Pick<SavedExpenseLite, 'amount' | 'group_purchase_total'>): number {
  return Number(expense.group_purchase_total ?? expense.amount)
}

/**
 * For each incoming row, the saved expense it most likely duplicates, or null.
 * Each saved expense is used at most once; the closest date wins.
 */
export function findProbableDuplicates(
  rows: IncomingRow[],
  candidates: SavedExpenseLite[],
  skip: boolean[] = []
): (SavedExpenseLite | null)[] {
  const used = new Set<string>()
  return rows.map((row, i) => {
    if (skip[i] || !row.bank || !row.date) return null
    const bank = row.bank.toLowerCase()
    const day = dayNumber(row.date)
    const amount = cents(row.amount)
    let best: SavedExpenseLite | null = null
    let bestDistance = Infinity
    for (const candidate of candidates) {
      if (used.has(candidate.id)) continue
      if ((candidate.bank ?? '').toLowerCase() !== bank) continue
      if (cents(chargedAmount(candidate)) !== amount) continue
      if (Math.sign(chargedAmount(candidate)) !== Math.sign(row.amount)) continue
      const distance = Math.abs(dayNumber(candidate.date) - day)
      if (distance > PROBABLE_DUPLICATE_DAYS || distance >= bestDistance) continue
      best = candidate
      bestDistance = distance
    }
    if (best) used.add(best.id)
    return best
  })
}

/** Date window to fetch candidates for a set of rows. */
export function candidateWindow(dates: string[]): { from: string; to: string } | null {
  const sorted = dates.filter(Boolean).sort()
  if (sorted.length === 0) return null
  const shift = (date: string, days: number) =>
    new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10)
  return {
    from: shift(sorted[0], -PROBABLE_DUPLICATE_DAYS),
    to: shift(sorted[sorted.length - 1], PROBABLE_DUPLICATE_DAYS),
  }
}
