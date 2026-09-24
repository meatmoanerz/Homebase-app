import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { parseBankCsv, type NormalizedTransaction } from '@/lib/import/bank-parsers'
import { downloadAmexCsv, type DownloadAmexCsvResult } from './browserbase'

const ROLLING_DAYS = 60

interface RawAmexTransaction {
  id: string
  source_transaction_id: string | null
  fingerprint: string
  occurrence_index: number
  status: 'unreviewed' | 'staged' | 'imported' | 'ignored'
  transaction_date: string
  description: string
  amount: number
  cardholder: string | null
}


export interface AmexSyncResult {
  ok: true
  fetched: number
  inserted: number
  alreadyKnown: number
  staged: number
  batchId: string | null
  batchLocked: boolean
  sessionId: string
  sessionUrl: string
  range: { start: string; end: string }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function rollingDateRange(now = new Date()): { start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (ROLLING_DAYS - 1))
  return { start: isoDate(start), end: isoDate(end) }
}

function normalizedDescription(description: string): string {
  return description.replace(/\s+/g, ' ').trim().toLocaleUpperCase('sv-SE')
}

export function transactionFingerprint(transaction: NormalizedTransaction): string {
  return createHash('sha256')
    .update([
      transaction.date,
      normalizedDescription(transaction.description),
      Number(transaction.amount).toFixed(2),
      (transaction.cardholder ?? '').trim().toLocaleUpperCase('sv-SE'),
    ].join('|'))
    .digest('hex')
}

function sourceTransactionId(row?: Record<string, string>): string | null {
  if (!row) return null
  const candidates = [
    'Transaction ID',
    'Transaction Id',
    'Transaktions-ID',
    'Transaction Identifier',
    'Transaktionsidentifierare',
    'Identifier',
  ]
  const key = Object.keys(row).find((header) =>
    candidates.some((candidate) => header.trim().toLowerCase() === candidate.toLowerCase())
  )
  const value = key ? row[key]?.trim() : ''
  return value || null
}

async function ingestTransactions(
  userId: string,
  transactions: NormalizedTransaction[],
  fetchedAt: string
): Promise<{ inserted: number; alreadyKnown: number }> {
  // The generated database type intentionally lags new migrations until the
  // migration is deployed; keep this admin-only integration locally typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceClient() as any
  if (transactions.length === 0) return { inserted: 0, alreadyKnown: 0 }
  const dates = transactions.map((transaction) => transaction.date).sort()
  const earliest = dates[0]

  const existing: RawAmexTransaction[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin
      .from('amex_sync_transactions')
      .select('id, source_transaction_id, fingerprint, occurrence_index, status')
      .eq('user_id', userId)
      .gte('transaction_date', earliest)
      .order('id')
      .range(offset, offset + 499)
    if (error) throw error
    existing.push(...(data as RawAmexTransaction[]))
    if (data.length < 500) break
  }
  const bySourceId = new Map(
    existing
      .filter((row) => row.source_transaction_id)
      .map((row) => [row.source_transaction_id as string, row])
  )
  const byOccurrence = new Map(
    existing.map((row) => [`${row.fingerprint}:${row.occurrence_index}`, row])
  )
  const occurrenceCounts = new Map<string, number>()
  const newRows: Array<Record<string, unknown>> = []
  const seenIds: string[] = []
  const sourceIdUpdates: Array<{ id: string; sourceTransactionId: string }> = []

  for (const transaction of transactions) {
    const fingerprint = transactionFingerprint(transaction)
    const occurrence = (occurrenceCounts.get(fingerprint) ?? 0) + 1
    occurrenceCounts.set(fingerprint, occurrence)
    const sourceId = sourceTransactionId(transaction.rawRow)
    const existingRow = (sourceId ? bySourceId.get(sourceId) : undefined)
      ?? byOccurrence.get(`${fingerprint}:${occurrence}`)

    if (existingRow) {
      if (sourceId && existingRow.source_transaction_id && sourceId !== existingRow.source_transaction_id) {
        throw new Error('Amex-exporten har ändrade transaktions-ID:n för identiska köp. Kontrollera exporten innan import.')
      }
      seenIds.push(existingRow.id)
      if (sourceId && !existingRow.source_transaction_id) {
        sourceIdUpdates.push({ id: existingRow.id, sourceTransactionId: sourceId })
      }
      continue
    }

    newRows.push({
      user_id: userId,
      source_transaction_id: sourceId,
      fingerprint,
      occurrence_index: occurrence,
      transaction_date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      cardholder: transaction.cardholder ?? null,
      status: 'unreviewed',
      first_seen_at: fetchedAt,
      last_seen_at: fetchedAt,
    })
  }

  for (let offset = 0; offset < seenIds.length; offset += 250) {
    const { error } = await admin
      .from('amex_sync_transactions')
      .update({ last_seen_at: fetchedAt })
      .in('id', seenIds.slice(offset, offset + 250))
    if (error) throw error
  }

  for (const update of sourceIdUpdates) {
    const { error } = await admin
      .from('amex_sync_transactions')
      .update({ source_transaction_id: update.sourceTransactionId, last_seen_at: fetchedAt })
      .eq('id', update.id)
    if (error) throw error
  }

  for (let offset = 0; offset < newRows.length; offset += 250) {
    const { error } = await admin
      .from('amex_sync_transactions')
      .insert(newRows.slice(offset, offset + 250))
    if (error) throw error
  }

  return { inserted: newRows.length, alreadyKnown: transactions.length - newRows.length }
}

async function rebuildReviewBatch(
  userId: string
): Promise<{ staged: number; batchId: string | null; batchLocked: boolean }> {
  // RPC owns the transaction and locks batch metadata before changing rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceClient() as any
  const { data, error } = await admin.rpc('rebuild_amex_review_batch', { p_user_id: userId })
  if (error) throw error
  return data
}
export async function runAmexSync(now = new Date()): Promise<AmexSyncResult> {
  const userId = process.env.AMEX_SYNC_USER_ID

  if (!userId) {
    throw new Error('AMEX_SYNC_USER_ID is not configured')
  }
  const range = rollingDateRange(now)
  const fetchedAt = now.toISOString()
  const downloaded: DownloadAmexCsvResult = await downloadAmexCsv(range.start, range.end)
  const parsed = parseBankCsv(downloaded.csvText, 'Amex')

  if (parsed.errors.length > 0 || parsed.transactions.length === 0) {
    throw new Error(`Amex-exporten innehöll inga giltiga transaktioner. ${parsed.errors.join(' ')}`)
  }

  const transactions = parsed.transactions.filter(
    (transaction) => transaction.date >= range.start && transaction.date <= range.end
  )
  const ingested = await ingestTransactions(userId, transactions, fetchedAt)
  const batch = await rebuildReviewBatch(userId)

  return {
    ok: true,
    fetched: transactions.length,
    inserted: ingested.inserted,
    alreadyKnown: ingested.alreadyKnown,
    staged: batch.staged,
    batchId: batch.batchId,
    batchLocked: batch.batchLocked,
    sessionId: downloaded.sessionId,
    sessionUrl: downloaded.sessionUrl,
    range,
  }
}
