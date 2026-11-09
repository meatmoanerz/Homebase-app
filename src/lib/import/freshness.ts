import { addDays, format, parseISO, subDays } from 'date-fns'

/** One person's bank, from import_freshness(): bank-file rows only (import_source 'csv'). */
export interface BankFreshnessRow {
  user_id: string
  bank: string
  /** Latest transaction date in a bank file (yyyy-MM-dd) */
  latest_date: string | null
  /** When a bank file was last read in (timestamptz) */
  last_upload: string | null
}

export interface StaleBank {
  userId: string
  bank: string
  /** Transactions are known through this day (yyyy-MM-dd) */
  coveredThrough: string
  /** First day that may be missing (yyyy-MM-dd) */
  missingFrom: string
}

/** A bank whose last file is older than this is taken as no longer in use. */
const IN_USE_DAYS = 45

/**
 * Banks to upload before budgeting: transactions should be in through yesterday.
 * A bank counts as covered through its latest transaction, or through the day
 * before its last upload — a quiet card (no purchases since the 15th) uploaded
 * yesterday is up to date, though its latest transaction is old. Amex books
 * purchases a day or two late, so the upload date matters there too.
 */
export function findStaleBanks(rows: BankFreshnessRow[], today: Date): StaleBank[] {
  const yesterday = format(subDays(today, 1), 'yyyy-MM-dd')
  const inUseSince = format(subDays(today, IN_USE_DAYS), 'yyyy-MM-dd')

  const stale: StaleBank[] = []
  for (const row of rows) {
    // Local date of the upload: an upload at 00:30 belongs to that day, not the UTC day before
    const uploadDay = row.last_upload ? format(new Date(row.last_upload), 'yyyy-MM-dd') : null
    if (!uploadDay || uploadDay < inUseSince) continue

    const byUpload = format(subDays(parseISO(uploadDay), 1), 'yyyy-MM-dd')
    const coveredThrough = row.latest_date && row.latest_date > byUpload ? row.latest_date : byUpload
    if (coveredThrough >= yesterday) continue

    stale.push({
      userId: row.user_id,
      bank: row.bank,
      coveredThrough,
      missingFrom: format(addDays(parseISO(coveredThrough), 1), 'yyyy-MM-dd'),
    })
  }
  return stale.sort((a, b) => a.coveredThrough.localeCompare(b.coveredThrough))
}
