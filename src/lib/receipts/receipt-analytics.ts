/**
 * Insights from grocery receipts: product groups, price changes, staples,
 * shopping rhythm and how much of the food spending the receipts cover.
 * Pure functions over the rows loaded by useReceiptLines().
 */

export interface ReceiptLine {
  id: string
  receipt_id: string
  product_id: string | null
  raw_name: string
  quantity: number
  unit_price: number | null
  total_price: number
  discount_amount: number
  is_deposit: boolean
  product: { id: string; name: string; unit: string | null } | null
}

export interface ReceiptHead {
  id: string
  purchase_date: string
  total_amount: number
  item_count: number
  expense_id: string | null
  store: { id: string; name: string; chain: string | null } | null
}

// ---------------------------------------------------------------- groups

export interface ProductGroup {
  key: string
  label: string
}

/** Ordered: the first matching rule wins ("Tonfisk vatten" is fish, not drink). */
const GROUP_RULES: Array<{ key: string; label: string; re: RegExp }> = [
  { key: 'barn', label: 'Barn', re: /semper|välling|barnmat|blöj|pampers|libero|up&go|nappar|tvättservett/i },
  { key: 'fisk', label: 'Fisk & skaldjur', re: /torsk|lax|tonfisk|räk|kräft|hummer|mussl|sill|fisk|skaldjur|krabba|pilgrim|hälleflundra|gös|abborre|kaviar/i },
  { key: 'snacks', label: 'Snacks & godis', re: /chips|godis|choklad|mandl|nötter|cashew|glass|kex|kaka|popcorn|lakrits|marabou|ostbåg/i },
  { key: 'kott', label: 'Kött & chark', re: /picanha|tri-?tip|wagyu|biff|färs(?!k)|fläsk|karré|kyckling|ank|mangalica|secreto|pluma|flankstek|stek|salami|skinka|korv|entrecote|oxfil|högrev|lamm|bacon|prosciutto|chorizo|bresaola|kött|nöt|kalkon|revben|chark|pancetta|guanciale/i },
  { key: 'mejeri', label: 'Mejeri, ost & ägg', re: /smör|\bost\b|ost$|grädde|gräddfil|mjölk|yoghurt|\bfil\b|färskost|brie|manchego|chaumes|kaltbach|prima donna|parmesan|mozzarella|burrata|cheddar|halloumi|crème|creme fraiche|ägg|kvarg|keso/i },
  { key: 'frukt', label: 'Frukt & grönt', re: /paprika|gurka|bär|melon|avokado|sparris|persilja|potatis|kål|jalapeño|jalapeno|pomelo|apelsin|citron|lime|tomat|lök|sallad|banan|äpple|päron|svamp|morot|morötter|broccoli|zucchini|aubergine|chili|ingefära|vitlök|koriander|basilika|dill|spenat|rucola|druv|mango|ananas|kiwi|grönsak|frukt/i },
  { key: 'brod', label: 'Bröd & spannmål', re: /bröd|levain|baguette|ris\b|jasminris|pasta|spaghetti|gröt|müsli|musli|flingor|mjöl|havre|tortilla|knäcke|bulle|croissant/i },
  { key: 'dryck', label: 'Dryck & kaffe', re: /cola|dryck|juice|kaffe|\bte\b|läsk|\böl\b|\bvin\b|cider|hydrate|\bvatten\b|loka|ramlösa|kombucha|smoothie|energi/i },
  { key: 'skafferi', label: 'Skafferi', re: /olj|vinäger|majonn|sås|ketchup|senap|krydd|buljong|kimchi|konserv|honung|sylt|socker|salt|peppar|tryffel|pesto|soja|sriracha|tahini|bönor|linser|kikärt/i },
  { key: 'hem', label: 'Hem & hygien', re: /tändvätska|kök|papper|tvål|disk|tvätt|schampo|tandkräm|påse|folie|batteri|ljus|rengöring|hushåll/i },
  { key: 'blommor', label: 'Blommor', re: /bukett|orkidé|tulpan|ros\b|blomm|växt/i },
]

const OTHER: ProductGroup = { key: 'ovrigt', label: 'Övrigt' }
const DEPOSIT: ProductGroup = { key: 'pant', label: 'Pant' }

export function productGroup(name: string, isDeposit = false): ProductGroup {
  if (isDeposit || /^pant\b/i.test(name)) return DEPOSIT
  const rule = GROUP_RULES.find((r) => r.re.test(name))
  return rule ? { key: rule.key, label: rule.label } : OTHER
}

// ---------------------------------------------------------------- products

export interface Purchase {
  date: string
  receiptId: string
  store: string | null
  quantity: number
  total: number
  /** Price per unit (kg/st/l) after discounts. */
  unitPrice: number
}

export interface ProductStat {
  key: string
  name: string
  unit: string | null
  group: ProductGroup
  purchases: Purchase[]
  count: number
  total: number
  avgPrice: number
  minPrice: number
  maxPrice: number
  /** Latest unit price relative to the earlier average (null with < 2 purchases). */
  priceChange: number | null
  /** Mean days between purchases (null with < 2 purchases on different days). */
  intervalDays: number | null
  lastDate: string
}

/** Same product even when the receipt line isn't linked to a product yet. */
export function productKey(line: ReceiptLine): string {
  if (line.product_id) return `p:${line.product_id}`
  return `n:${line.raw_name.toLowerCase().replace(/[^a-zåäö0-9]+/g, ' ').trim()}`
}

/** Product name, or the raw receipt text made readable ("GURKA" → "Gurka"). */
export function displayName(line: Pick<ReceiptLine, 'raw_name' | 'product'>): string {
  const name = line.product?.name || line.raw_name
  return name === name.toUpperCase() && name.length > 3
    ? name.charAt(0) + name.slice(1).toLowerCase()
    : name
}

/** "0,5 kg" for weighed goods, "2 st" for several pieces, '' for one piece. */
export function quantityLabel(quantity: number, unit: string | null | undefined): string {
  const q = Number(quantity)
  if (unit === 'kg' || unit === 'l') return `${q.toLocaleString('sv-SE', { maximumFractionDigits: 3 })} ${unit}`
  return q !== 1 ? `${q.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} st` : ''
}

export function productStats(lines: ReceiptLine[], receipts: Map<string, ReceiptHead>): ProductStat[] {
  const map = new Map<string, ProductStat>()
  for (const line of lines) {
    const receipt = receipts.get(line.receipt_id)
    if (!receipt) continue
    const key = productKey(line)
    let stat = map.get(key)
    if (!stat) {
      const name = displayName(line)
      stat = {
        key,
        name,
        unit: line.product?.unit ?? null,
        group: productGroup(name, line.is_deposit),
        purchases: [],
        count: 0,
        total: 0,
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        priceChange: null,
        intervalDays: null,
        lastDate: receipt.purchase_date,
      }
      map.set(key, stat)
    }
    const qty = Number(line.quantity) > 0 ? Number(line.quantity) : 1
    const total = Number(line.total_price)
    stat.purchases.push({
      date: receipt.purchase_date,
      receiptId: line.receipt_id,
      store: receipt.store?.chain || receipt.store?.name || null,
      quantity: qty,
      total,
      unitPrice: total / qty,
    })
    stat.total += total
  }

  for (const stat of map.values()) {
    stat.purchases.sort((a, b) => a.date.localeCompare(b.date))
    stat.count = stat.purchases.length
    const prices = stat.purchases.map((p) => p.unitPrice).filter((p) => p > 0)
    stat.avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
    stat.minPrice = prices.length ? Math.min(...prices) : 0
    stat.maxPrice = prices.length ? Math.max(...prices) : 0
    stat.lastDate = stat.purchases[stat.purchases.length - 1].date
    if (prices.length >= 2) {
      const earlier = prices.slice(0, -1)
      const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length
      stat.priceChange = earlierAvg > 0 ? (prices[prices.length - 1] - earlierAvg) / earlierAvg : null
    }
    const days = [...new Set(stat.purchases.map((p) => p.date))]
    if (days.length >= 2) {
      const span = (Date.parse(days[days.length - 1]) - Date.parse(days[0])) / 86_400_000
      stat.intervalDays = span / (days.length - 1)
    }
  }
  return [...map.values()]
}

// ---------------------------------------------------------------- overview

export interface GroupTotal {
  group: ProductGroup
  total: number
  count: number
}

export function groupTotals(products: ProductStat[]): GroupTotal[] {
  const map = new Map<string, GroupTotal>()
  for (const p of products) {
    const g = map.get(p.group.key) ?? { group: p.group, total: 0, count: 0 }
    g.total += p.total
    g.count += p.count
    map.set(p.group.key, g)
  }
  return [...map.values()].filter((g) => g.group.key !== 'pant').sort((a, b) => b.total - a.total)
}

export function monthlyTotals(receipts: ReceiptHead[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of receipts) {
    const month = r.purchase_date.slice(0, 7)
    map.set(month, (map.get(month) || 0) + Number(r.total_amount))
  }
  return map
}

const WEEKDAYS = ['söndagar', 'måndagar', 'tisdagar', 'onsdagar', 'torsdagar', 'fredagar', 'lördagar']

export function weekdayPattern(receipts: ReceiptHead[]): { label: string; share: number } | null {
  if (receipts.length < 6) return null
  const counts = new Array(7).fill(0)
  for (const r of receipts) counts[new Date(`${r.purchase_date}T12:00:00`).getDay()]++
  const max = Math.max(...counts)
  const share = max / receipts.length
  // Only worth saying when one day clearly stands out.
  if (share < 0.3) return null
  return { label: WEEKDAYS[counts.indexOf(max)], share }
}

export interface ExpenseLike {
  id: string
  date: string
  amount: number
  description: string
  category?: { name?: string | null } | null
}

/**
 * Receipts matched to bank/card expenses: linked explicitly, or same amount
 * (±1 kr) within two days of the purchase.
 */
export function matchReceiptsToExpenses(receipts: ReceiptHead[], expenses: ExpenseLike[]): Map<string, ExpenseLike> {
  const byId = new Map(expenses.map((e) => [e.id, e]))
  const used = new Set<string>()
  const matches = new Map<string, ExpenseLike>()
  for (const r of receipts) {
    const linked = r.expense_id ? byId.get(r.expense_id) : undefined
    if (linked) {
      matches.set(r.id, linked)
      used.add(linked.id)
    }
  }
  for (const r of receipts) {
    if (matches.has(r.id)) continue
    const t = Date.parse(r.purchase_date)
    const candidate = expenses.find(
      (e) =>
        !used.has(e.id) &&
        Math.abs(Number(e.amount) - Number(r.total_amount)) <= 1 &&
        Math.abs(Date.parse(e.date) - t) <= 2 * 86_400_000
    )
    if (candidate) {
      matches.set(r.id, candidate)
      used.add(candidate.id)
    }
  }
  return matches
}
