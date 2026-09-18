import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { parseBankCsv, type NormalizedTransaction } from '@/lib/import/bank-parsers'
import { downloadAmexCsv, type DownloadAmexCsvResult } from './browserbase'

const ROLLING_DAYS = 60

type CostAssignment = 'personal' | 'shared' | 'partner'

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

interface CategoryMapping {
  id: string
  pattern: string
  category_id: string | null
  cost_assignment: CostAssignment | null
  match_type: 'contains' | 'starts_with' | 'exact'
  bank: string | null
  priority: number
}

interface ImportBatch {
  id: string
  opened_at: string | null
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

function matchesMapping(description: string, mapping: CategoryMapping): boolean {
  const value = description.toLowerCase()
  const pattern = mapping.pattern.toLowerCase()
  if (mapping.match_type === 'exact') return value === pattern
  if (mapping.match_type === 'starts_with') return value.startsWith(pattern)
  return value.includes(pattern)
}

function bestMapping(
  description: string,
  mappings: CategoryMapping[]
): CategoryMapping | null {
  const matches = mappings
    .filter((mapping) => !mapping.bank || mapping.bank.toLowerCase() === 'amex')
    .filter((mapping) => matchesMapping(description, mapping))
    .sort((a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length)
  return matches[0] ?? null
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
  const dates = transactions.map((transaction) => transaction.date).sort()
  const earliest = dates[0]

  const { data: existingData, error: existingError } = await admin
    .from('amex_sync_transactions')
    .select('id, source_transaction_id, fingerprint, occurrence_index, status')
    .eq('user_id', userId)
    .gte('transaction_date', earliest)

  if (existingError) throw existingError

  const existing = (existingData ?? []) as RawAmexTransaction[]
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
  userId: string,
  fetchedAt: string
): Promise<{ staged: number; batchId: string | null; batchLocked: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceClient() as any

  const { data: existingBatchData, error: batchReadError } = await admin
    .from('import_batches')
    .select('id, opened_at')
    .eq('user_id', userId)
    .eq('source', 'amex_auto')
    .maybeSingle()
  if (batchReadError) throw batchReadError

  let batch = existingBatchData as ImportBatch | null
  if (batch?.opened_at) {
    return { staged: 0, batchId: batch.id, batchLocked: true }
  }

  if (batch) {
    const { error: releaseError } = await admin
      .from('amex_sync_transactions')
      .update({ status: 'unreviewed', staging_batch_id: null })
      .eq('user_id', userId)
      .eq('staging_batch_id', batch.id)
      .eq('status', 'staged')
    if (releaseError) throw releaseError

    const { error: clearError } = await admin
      .from('import_staging')
      .delete()
      .eq('user_id', userId)
      .eq('batch_id', batch.id)
    if (clearError) throw clearError
  } else {
    const { data, error } = await admin
      .from('import_batches')
      .insert({ user_id: userId, source: 'amex_auto' })
      .select('id, opened_at')
      .single()
    if (error) throw error
    batch = data as ImportBatch
  }

  const { data: rawData, error: rawError } = await admin
    .from('amex_sync_transactions')
    .select('id, transaction_date, description, amount, cardholder')
    .eq('user_id', userId)
    .eq('status', 'unreviewed')
    .order('transaction_date', { ascending: false })
  if (rawError) throw rawError

  const rawRows = (rawData ?? []) as RawAmexTransaction[]
  if (rawRows.length === 0) {
    const { error } = await admin.from('import_batches').delete().eq('id', batch.id)
    if (error) throw error
    return { staged: 0, batchId: null, batchLocked: false }
  }

  const { data: mappingData, error: mappingError } = await admin
    .from('category_mappings')
    .select('id, pattern, category_id, cost_assignment, match_type, bank, priority')
    .eq('user_id', userId)
  if (mappingError) throw mappingError
  const mappings = (mappingData ?? []) as CategoryMapping[]
  const expiresAt = new Date(Date.parse(fetchedAt) + 48 * 60 * 60 * 1000).toISOString()

  const stagingRows = rawRows.map((row) => {
    const mapping = bestMapping(row.description, mappings)
    return {
      batch_id: batch.id,
      user_id: userId,
      uploaded_at: fetchedAt,
      expires_at: expiresAt,
      pinned: false,
      bank: 'Amex',
      date: row.transaction_date,
      description: row.description,
      amount: row.amount,
      category_id: mapping?.category_id ?? null,
      cost_assignment: mapping?.cost_assignment ?? 'shared',
      is_ccm: true,
      match_source: mapping ? 'mappning' : 'blank',
      selected: true,
      status: 'pending',
      cardholder: row.cardholder,
      amex_sync_transaction_id: row.id,
    }
  })

  for (let offset = 0; offset < stagingRows.length; offset += 250) {
    const { error } = await admin
      .from('import_staging')
      .insert(stagingRows.slice(offset, offset + 250))
    if (error) throw error
  }

  const rawIds = rawRows.map((row) => row.id)
  for (let offset = 0; offset < rawIds.length; offset += 250) {
    const { error } = await admin
      .from('amex_sync_transactions')
      .update({ status: 'staged', staging_batch_id: batch.id })
      .in('id', rawIds.slice(offset, offset + 250))
    if (error) throw error
  }

  return { staged: stagingRows.length, batchId: batch.id, batchLocked: false }
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

  if (parsed.transactions.length === 0) {
    throw new Error(`Amex-exporten innehöll inga giltiga transaktioner. ${parsed.errors.join(' ')}`)
  }

  const transactions = parsed.transactions.filter(
    (transaction) => transaction.date >= range.start && transaction.date <= range.end
  )
  const ingested = await ingestTransactions(userId, transactions, fetchedAt)
  const batch = await rebuildReviewBatch(userId, fetchedAt)

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
