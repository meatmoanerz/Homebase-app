import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedReceipt } from '@/lib/receipts/parse-receipt'
import { packageFromName, type PackageSize } from '@/lib/receipts/package-size'

/**
 * Stores a parsed receipt: finds or creates the store, skips duplicates,
 * links lines to known products (article number, then alias, then name) and
 * matches the receipt to the card/bank purchase it belongs to.
 * Works with the user's own client (RLS) and with the service client; every
 * row gets user_id explicitly.
 */

export interface SaveResult {
  receiptId: string
  duplicate: boolean
  itemCount: number
  linkedProducts: number
  expenseId: string | null
  /** Line totals differ from the receipt total by more than 2 kr. */
  totalsMismatch: boolean
}

// The generated database types lag the receipt tables; keep these queries locally typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

const round2 = (n: number) => Math.round(n * 100) / 100

function todayStockholm(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date())
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function saveParsedReceipt(db: Db, userId: string, parsed: ParsedReceipt): Promise<SaveResult> {
  const purchaseDate = parsed.purchase_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.purchase_date) ? parsed.purchase_date : todayStockholm()
  const lineTotal = round2(parsed.lines.reduce((s, l) => s + l.total_price, 0))
  const total = round2(parsed.total_amount ?? lineTotal)
  const totalsMismatch = Math.abs(lineTotal - total) > 2

  // Store: same name for this user, else a new one.
  let storeId: string | null = null
  if (parsed.store_name) {
    const { data: store } = await db.from('stores').select('id').eq('user_id', userId).ilike('name', parsed.store_name).maybeSingle()
    if (store) storeId = store.id
    else {
      const { data: created, error } = await db
        .from('stores')
        .insert({ user_id: userId, name: parsed.store_name, chain: parsed.store_chain, location: parsed.store_location })
        .select('id')
        .single()
      if (error) throw error
      storeId = created.id
    }
  }

  // Duplicate: same day, same total, same store.
  let dupQuery = db.from('receipts').select('id, item_count, expense_id').eq('user_id', userId).eq('purchase_date', purchaseDate).eq('total_amount', total)
  dupQuery = storeId ? dupQuery.eq('store_id', storeId) : dupQuery.is('store_id', null)
  const { data: dup } = await dupQuery.limit(1).maybeSingle()
  if (dup) {
    return { receiptId: dup.id, duplicate: true, itemCount: dup.item_count, linkedProducts: 0, expenseId: dup.expense_id, totalsMismatch: false }
  }

  // Known products: by article number (aliases and earlier lines), then alias text, then product name.
  const articleNumbers = [...new Set(parsed.lines.map((l) => l.article_number).filter((a): a is string => !!a))]
  const byArticle = new Map<string, string>()
  if (articleNumbers.length > 0) {
    const { data: aliasRows } = await db.from('product_aliases').select('article_number, product_id').eq('user_id', userId).in('article_number', articleNumbers)
    for (const a of aliasRows ?? []) if (a.article_number) byArticle.set(a.article_number, a.product_id)
    const { data: lineRows } = await db
      .from('receipt_items')
      .select('article_number, product_id')
      .eq('user_id', userId)
      .in('article_number', articleNumbers)
      .not('product_id', 'is', null)
    for (const l of lineRows ?? []) if (l.article_number && !byArticle.has(l.article_number)) byArticle.set(l.article_number, l.product_id)
  }
  // Pack sizes known from earlier lines of the same article.
  const sizeByArticle = new Map<string, PackageSize>()
  if (articleNumbers.length > 0) {
    const { data: sized } = await db
      .from('receipt_items')
      .select('article_number, package_size, package_unit')
      .eq('user_id', userId)
      .in('article_number', articleNumbers)
      .in('package_unit', ['l', 'st', 'kg'])
    for (const l of sized ?? []) {
      if (l.article_number && !(l.package_unit === 'kg' && Number(l.package_size) === 1)) {
        sizeByArticle.set(l.article_number, { size: Number(l.package_size), unit: l.package_unit })
      }
    }
  }
  const { data: aliasNames } = await db.from('product_aliases').select('raw_name_pattern, product_id').eq('user_id', userId)
  const { data: productNames } = await db.from('products').select('id, name').eq('user_id', userId)
  const byName = new Map<string, string>()
  for (const p of productNames ?? []) byName.set(p.name.toLowerCase(), p.id)
  for (const a of aliasNames ?? []) if (a.raw_name_pattern) byName.set(a.raw_name_pattern.toLowerCase(), a.product_id)

  const { data: receipt, error: receiptError } = await db
    .from('receipts')
    .insert({
      user_id: userId,
      store_id: storeId,
      purchase_date: purchaseDate,
      receipt_number: parsed.receipt_number,
      total_amount: total,
      item_count: parsed.lines.filter((l) => !l.is_deposit).length,
    })
    .select('id')
    .single()
  if (receiptError) throw receiptError

  let linkedProducts = 0
  const items = parsed.lines.map((l) => {
    const productId = l.is_deposit ? null : (l.article_number && byArticle.get(l.article_number)) || byName.get(l.name.toLowerCase()) || null
    if (productId) linkedProducts++
    // Sold by weight/volume: the quantity is the amount. Otherwise the pack size
    // from the receipt, an earlier line of the article, or the name.
    const pack: PackageSize | null =
      l.unit === 'kg' || l.unit === 'l'
        ? { size: 1, unit: l.unit }
        : l.package_size && l.package_size > 0 && l.package_unit
          ? { size: l.package_size, unit: l.package_unit }
          : (l.article_number && sizeByArticle.get(l.article_number)) || (l.is_deposit ? null : packageFromName(l.name))
    return {
      user_id: userId,
      receipt_id: receipt.id,
      product_id: productId,
      raw_name: l.name,
      article_number: l.article_number,
      quantity: l.quantity,
      unit_price: l.unit_price,
      total_price: round2(l.total_price),
      discount_amount: round2(l.discount_amount),
      is_deposit: l.is_deposit,
      package_size: pack?.size ?? null,
      package_unit: pack?.unit ?? null,
      needs_review: totalsMismatch,
    }
  })
  const { error: itemsError } = await db.from('receipt_items').insert(items)
  if (itemsError) {
    await db.from('receipts').delete().eq('id', receipt.id)
    throw itemsError
  }

  // The card/bank purchase: same amount (±1 kr) within two days, not already taken.
  let expenseId: string | null = null
  const { data: candidates } = await db
    .from('expenses')
    .select('id, date, amount')
    .eq('user_id', userId)
    .gte('date', shiftDate(purchaseDate, -2))
    .lte('date', shiftDate(purchaseDate, 2))
    .gte('amount', total - 1)
    .lte('amount', total + 1)
  if (candidates && candidates.length > 0) {
    const { data: taken } = await db.from('receipts').select('expense_id').eq('user_id', userId).in('expense_id', candidates.map((c) => c.id))
    const takenIds = new Set((taken ?? []).map((t) => t.expense_id))
    const best = candidates
      .filter((c) => !takenIds.has(c.id))
      .sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(purchaseDate)) - Math.abs(Date.parse(b.date) - Date.parse(purchaseDate)))[0]
    if (best) {
      expenseId = best.id
      await db.from('receipts').update({ expense_id: best.id }).eq('id', receipt.id)
    }
  }

  return { receiptId: receipt.id, duplicate: false, itemCount: items.length, linkedProducts, expenseId, totalsMismatch }
}
