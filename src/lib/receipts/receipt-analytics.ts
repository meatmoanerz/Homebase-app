/**
 * Insights from grocery receipts: product groups, price changes, staples,
 * shopping rhythm and how much of the food spending the receipts cover.
 * Pure functions over the rows loaded by useReceiptLines().
 */

import { formatPackage, packageFromName, type MeasureUnit, type PackageSize } from '@/lib/receipts/package-size'

export interface ReceiptLine {
  id: string
  receipt_id: string
  product_id: string | null
  raw_name: string
  article_number?: string | null
  quantity: number
  unit_price: number | null
  total_price: number
  discount_amount: number
  is_deposit: boolean
  /** How much one quantity contains (kg/l/st); for goods sold by weight 1 kg. */
  package_size?: number | null
  package_unit?: string | null
  product: { id: string; name: string; unit: string | null; product_group?: string | null } | null
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

/** Groups the user can pick from, in display order. */
export const PRODUCT_GROUPS: ProductGroup[] = [
  ...GROUP_RULES.map((r) => ({ key: r.key, label: r.label })),
  OTHER,
]

/**
 * The product's group: the one the user saved on the product wins, otherwise
 * a guess from the name.
 */
export function productGroup(name: string, isDeposit = false, stored?: string | null): ProductGroup {
  if (isDeposit || /^pant\b/i.test(name)) return DEPOSIT
  if (stored) {
    const chosen = PRODUCT_GROUPS.find((g) => g.key === stored)
    if (chosen) return chosen
  }
  const rule = GROUP_RULES.find((r) => r.re.test(name))
  return rule ? { key: rule.key, label: rule.label } : OTHER
}

// ---------------------------------------------------------------- products
//
// A product ("Smör") is made of one or more articles: the store's article
// numbers ("Smör NS 82%", "Smör NS 80%"). Every price is compared per kg,
// litre or piece when the pack size is known, otherwise per package, and then
// only within the same article.

/** What a price is compared per: kg/l/st, or per package when the size is unknown. */
export type PriceBasis = MeasureUnit | 'pack'

export interface Purchase {
  lineId: string
  date: string
  receiptId: string
  store: string | null
  /** Packages, or kg for goods sold by weight. */
  quantity: number
  weighed: boolean
  total: number
  discount: number
  articleKey: string
  articleName: string
  /** kg/l/st the line contains, null when the pack size is unknown. */
  amount: number | null
  measure: MeasureUnit | null
  /** Paid per package (total / quantity). */
  packPrice: number
  /** Paid per kg/l/st, null when the pack size is unknown. */
  measurePrice: number | null
  /** Price in the product's basis, null when this purchase can't be compared on it. */
  price: number | null
}

export interface ArticleStat {
  key: string
  articleNumber: string | null
  /** Latest receipt text, made readable. */
  name: string
  /** Every receipt text seen for the article (the store sometimes renames it). */
  names: string[]
  /** The same texts exactly as on the receipts (for aliases). */
  rawNames: string[]
  size: PackageSize | null
  /** Where the size comes from: saved on the line, read from the name, or sold by weight. */
  sizeSource: 'saved' | 'name' | 'weighed' | null
  basis: PriceBasis
  purchases: Purchase[]
  lineIds: string[]
  count: number
  total: number
  /** Average paid in the article's basis. */
  avgPrice: number
  latestPrice: number
  /** Latest price against the article's earlier average (null with one purchase). */
  priceChange: number | null
  firstDate: string
  lastDate: string
}

export interface ArticleSwitch {
  /** First purchase of the new article. */
  date: string
  from: ArticleStat
  to: ArticleStat
  /** Price of the new article against the old one's last price. */
  priceChange: number | null
  /** True when the change is per package because a pack size is missing. */
  perPack: boolean
  /**
   * The store replaced the article: the names only differ in numbers or a
   * word ("Smör NS 85%" → "Smör NS 80%") and the old one hasn't been bought
   * since. Otherwise it is just another variant of the product.
   */
  replaced: boolean
  /** What changed in the name, e.g. "85% → 80%" (null when nothing simple). */
  nameChange: string | null
}

export interface ProductStat {
  key: string
  /** Linked product, or null while the lines are only grouped by name/article. */
  productId: string | null
  /** True when the group was chosen by the user rather than guessed. */
  groupChosen: boolean
  name: string
  unit: string | null
  group: ProductGroup
  basis: PriceBasis
  purchases: Purchase[]
  articles: ArticleStat[]
  switches: ArticleSwitch[]
  count: number
  total: number
  /** Average paid in the basis (total / amount, so a big pack weighs more). */
  avgPrice: number
  latestPrice: number | null
  minPrice: number
  maxPrice: number
  /** Purchases that can be compared on the basis. */
  comparable: number
  /** Latest price against the earlier average, like for like (null when not comparable). */
  priceChange: number | null
  /** Mean days between purchases (null with < 2 purchases on different days). */
  intervalDays: number | null
  lastDate: string
  /** Receipt texts and article numbers seen for this product (for aliases). */
  rawNames: string[]
  articleNumbers: string[]
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-zåäöé0-9%]+/g, ' ').trim()

/**
 * Same product even when the receipt line isn't linked to a product yet:
 * by product, else by the store's article number, else by normalised name.
 */
export function productKey(line: ReceiptLine): string {
  if (line.is_deposit) return 'd:pant'
  if (line.product_id) return `p:${line.product_id}`
  if (line.article_number) return `a:${line.article_number}`
  return `n:${normalise(line.raw_name)}`
}

/** The store's article: its article number, else the receipt text. */
export function articleKey(line: Pick<ReceiptLine, 'article_number' | 'raw_name'>): string {
  return line.article_number ? `a:${line.article_number}` : `n:${normalise(line.raw_name)}`
}

/** "GURKA IMPORT" → "Gurka import"; other text unchanged. */
export function readable(name: string): string {
  return name === name.toUpperCase() && name.length > 3 ? name.charAt(0) + name.slice(1).toLowerCase() : name
}

/** Product name, or the raw receipt text made readable ("GURKA" → "Gurka"). */
export function displayName(line: Pick<ReceiptLine, 'raw_name' | 'product'>): string {
  return readable(line.product?.name || line.raw_name)
}

/** True when the line's quantity is a weight in kg. */
export function isWeighed(line: Pick<ReceiptLine, 'quantity' | 'package_size' | 'package_unit'>): boolean {
  if (line.package_unit === 'kg' && Number(line.package_size) === 1) return true
  return !line.package_unit && !Number.isInteger(Number(line.quantity))
}

/** "0,5 kg" for weighed goods, "2 st" for several pieces, '' for one piece. */
export function quantityLabel(quantity: number, unit: string | null | undefined): string {
  const q = Number(quantity)
  if (unit === 'kg' || unit === 'l') return `${q.toLocaleString('sv-SE', { maximumFractionDigits: 3 })} ${unit}`
  return q !== 1 ? `${q.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} st` : ''
}

/** "0,41 kg", "2 × 6 st", "380 g", "2 st" or '' for one package of unknown size. */
export function purchaseLabel(p: Pick<Purchase, 'quantity' | 'weighed' | 'amount' | 'measure'>): string {
  const q = p.quantity.toLocaleString('sv-SE', { maximumFractionDigits: 3 })
  if (p.weighed) return `${q} kg`
  if (p.amount && p.measure) {
    const pack = formatPackage({ size: p.amount / p.quantity, unit: p.measure })
    return p.quantity !== 1 ? `${q} × ${pack}` : pack
  }
  return p.quantity !== 1 ? `${q} st` : ''
}

export function basisLabel(basis: PriceBasis): string {
  return `kr${perLabel(basis)}`
}

/** Suffix after a formatted price: "116 kr" + "/kg". */
export function perLabel(basis: PriceBasis): string {
  return basis === 'kg' ? '/kg' : basis === 'l' ? '/l' : '/st'
}

function savedSize(line: ReceiptLine): PackageSize | null {
  const size = Number(line.package_size)
  const unit = line.package_unit
  return size > 0 && (unit === 'kg' || unit === 'l' || unit === 'st') ? { size, unit } : null
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

const tokens = (name: string) => normalise(name).split(' ').filter(Boolean)
const isNumeric = (t: string) => /\d/.test(t)

/** Names alike enough to be the same item re-numbered: the word tokens mostly overlap. */
function similarNames(a: string, b: string): boolean {
  const wa = new Set(tokens(a).filter((t) => !isNumeric(t)))
  const wb = new Set(tokens(b).filter((t) => !isNumeric(t)))
  const shared = [...wa].filter((t) => wb.has(t)).length
  const union = new Set([...wa, ...wb]).size
  return union > 0 && shared / union >= 0.6
}

/** "85% → 80%": the tokens that differ between two names, when there are few. */
function nameDiff(a: string, b: string): string | null {
  const ta = tokens(a)
  const tb = tokens(b)
  const onlyA = ta.filter((t) => !tb.includes(t))
  const onlyB = tb.filter((t) => !ta.includes(t))
  if (onlyA.length === 0 || onlyB.length === 0 || onlyA.length > 2 || onlyB.length > 2) return null
  return `${onlyA.join(' ')} → ${onlyB.join(' ')}`
}

function changeAgainstEarlier(items: Array<{ price: number; weight: number; total: number }>): number | null {
  if (items.length < 2) return null
  const earlier = items.slice(0, -1)
  const weight = sum(earlier.map((e) => e.weight))
  const earlierAvg = weight > 0 ? sum(earlier.map((e) => e.total)) / weight : 0
  return earlierAvg > 0 ? (items[items.length - 1].price - earlierAvg) / earlierAvg : null
}

export function productStats(lines: ReceiptLine[], receipts: Map<string, ReceiptHead>): ProductStat[] {
  // A size saved on one line of an article holds for its other lines too.
  const savedByArticle = new Map<string, PackageSize>()
  for (const line of lines) {
    const saved = savedSize(line)
    if (saved && !isWeighed(line)) savedByArticle.set(articleKey(line), saved)
  }

  const map = new Map<string, ProductStat>()
  const articleMaps = new Map<string, Map<string, ArticleStat>>()
  for (const line of lines) {
    const receipt = receipts.get(line.receipt_id)
    if (!receipt) continue
    const key = productKey(line)
    let stat = map.get(key)
    if (!stat) {
      const name = line.is_deposit ? 'Pant' : displayName(line)
      stat = {
        key,
        productId: line.is_deposit ? null : line.product_id,
        groupChosen: !line.is_deposit && !!line.product?.product_group,
        name,
        unit: line.product?.unit ?? null,
        group: productGroup(name, line.is_deposit, line.product?.product_group),
        basis: 'pack',
        purchases: [],
        articles: [],
        switches: [],
        count: 0,
        total: 0,
        avgPrice: 0,
        latestPrice: null,
        minPrice: 0,
        maxPrice: 0,
        comparable: 0,
        priceChange: null,
        intervalDays: null,
        lastDate: receipt.purchase_date,
        rawNames: [],
        articleNumbers: [],
      }
      map.set(key, stat)
      articleMaps.set(key, new Map())
    }
    if (!stat.rawNames.includes(line.raw_name)) stat.rawNames.push(line.raw_name)
    if (line.article_number && !stat.articleNumbers.includes(line.article_number)) stat.articleNumbers.push(line.article_number)

    const aKey = articleKey(line)
    const articles = articleMaps.get(key)!
    let article = articles.get(aKey)
    if (!article) {
      article = {
        key: aKey,
        articleNumber: line.article_number ?? null,
        name: readable(line.raw_name),
        names: [],
        rawNames: [],
        size: null,
        sizeSource: null,
        basis: 'pack',
        purchases: [],
        lineIds: [],
        count: 0,
        total: 0,
        avgPrice: 0,
        latestPrice: 0,
        priceChange: null,
        firstDate: receipt.purchase_date,
        lastDate: receipt.purchase_date,
      }
      articles.set(aKey, article)
    }
    const text = readable(line.raw_name)
    if (!article.names.includes(text)) article.names.push(text)
    if (!article.rawNames.includes(line.raw_name)) article.rawNames.push(line.raw_name)
    article.lineIds.push(line.id)

    // Pack size: saved on the line or the article, sold by weight, or written in the name.
    let size: PackageSize | null = null
    let source: ArticleStat['sizeSource'] = null
    if (isWeighed(line)) {
      size = { size: 1, unit: 'kg' }
      source = 'weighed'
    } else if (savedSize(line) || savedByArticle.get(aKey)) {
      size = savedSize(line) ?? savedByArticle.get(aKey)!
      source = 'saved'
    } else {
      size = packageFromName(line.raw_name)
      source = size ? 'name' : null
    }
    if (size && (!article.size || source === 'saved')) {
      article.size = size
      article.sizeSource = source
    }

    const qty = Number(line.quantity) > 0 ? Number(line.quantity) : 1
    const total = Number(line.total_price)
    const amount = size ? qty * size.size : null
    stat.purchases.push({
      lineId: line.id,
      date: receipt.purchase_date,
      receiptId: line.receipt_id,
      store: receipt.store?.chain || receipt.store?.name || null,
      quantity: qty,
      weighed: source === 'weighed',
      total,
      discount: Number(line.discount_amount || 0),
      articleKey: aKey,
      articleName: text,
      amount,
      measure: size?.unit ?? null,
      packPrice: total / qty,
      measurePrice: amount ? total / amount : null,
      price: null,
    })
    stat.total += total
  }

  for (const stat of map.values()) {
    const purchases = stat.purchases.sort((a, b) => a.date.localeCompare(b.date))
    stat.count = purchases.length
    stat.lastDate = purchases[purchases.length - 1].date

    // Basis: the measure most purchases have, if at least half do; else per package.
    const byMeasure = new Map<MeasureUnit, number>()
    for (const p of purchases) if (p.measure) byMeasure.set(p.measure, (byMeasure.get(p.measure) || 0) + 1)
    const [measure, n] = [...byMeasure.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
    stat.basis = measure && n * 2 >= purchases.length ? measure : 'pack'

    for (const p of purchases) {
      p.price = stat.basis === 'pack' ? p.packPrice : p.measure === stat.basis ? p.measurePrice : null
      if (p.price != null && p.price <= 0) p.price = null
    }
    const comparable = purchases.filter((p) => p.price != null)
    stat.comparable = comparable.length
    const weightOf = (p: Purchase) => (stat.basis === 'pack' ? p.quantity : p.amount ?? 0)
    const weight = sum(comparable.map(weightOf))
    stat.avgPrice = weight > 0 ? sum(comparable.map((p) => p.total)) / weight : 0
    stat.latestPrice = comparable.length ? comparable[comparable.length - 1].price : null
    stat.minPrice = comparable.length ? Math.min(...comparable.map((p) => p.price!)) : 0
    stat.maxPrice = comparable.length ? Math.max(...comparable.map((p) => p.price!)) : 0

    // Like for like: per kg/l/st across articles, per package only within the latest article.
    const latest = purchases[purchases.length - 1]
    const series = stat.basis === 'pack' ? comparable.filter((p) => p.articleKey === latest.articleKey) : comparable
    stat.priceChange =
      series.length && series[series.length - 1] === latest
        ? changeAgainstEarlier(series.map((p) => ({ price: p.price!, weight: weightOf(p), total: p.total })))
        : null

    const days = [...new Set(purchases.map((p) => p.date))]
    if (days.length >= 2) {
      const span = (Date.parse(days[days.length - 1]) - Date.parse(days[0])) / 86_400_000
      stat.intervalDays = span / (days.length - 1)
    }

    // Articles, oldest first.
    const articles = [...articleMaps.get(stat.key)!.values()]
    for (const a of articles) {
      a.purchases = purchases.filter((p) => p.articleKey === a.key)
      a.count = a.purchases.length
      a.total = sum(a.purchases.map((p) => p.total))
      a.firstDate = a.purchases[0].date
      a.lastDate = a.purchases[a.purchases.length - 1].date
      a.name = a.purchases[a.purchases.length - 1].articleName
      a.basis = a.size?.unit ?? 'pack'
      const items = a.purchases
        .map((p) => ({ price: (a.basis === 'pack' ? p.packPrice : p.measurePrice) ?? 0, weight: a.basis === 'pack' ? p.quantity : p.amount ?? 0, total: p.total }))
        .filter((i) => i.price > 0)
      const w = sum(items.map((i) => i.weight))
      a.avgPrice = w > 0 ? sum(items.map((i) => i.total)) / w : 0
      a.latestPrice = items.length ? items[items.length - 1].price : 0
      a.priceChange = changeAgainstEarlier(items)
    }
    articles.sort((a, b) => a.firstDate.localeCompare(b.firstDate) || a.key.localeCompare(b.key))
    stat.articles = articles

    // Switches: a new article appears; the one bought most recently before it is what it follows.
    for (const to of articles.slice(1)) {
      const before = purchases.filter((p) => p.date < to.firstDate && p.articleKey !== to.key)
      if (before.length === 0) continue
      const from = articles.find((a) => a.key === before[before.length - 1].articleKey)!
      const fromLast = from.purchases.filter((p) => p.date < to.firstDate).pop()!
      const toFirst = to.purchases[0]
      const comparableMeasure = fromLast.measure && fromLast.measure === toFirst.measure
      const oldPrice = comparableMeasure ? fromLast.measurePrice! : fromLast.packPrice
      const newPrice = comparableMeasure ? toFirst.measurePrice! : toFirst.packPrice
      stat.switches.push({
        date: to.firstDate,
        from,
        to,
        priceChange: oldPrice > 0 ? (newPrice - oldPrice) / oldPrice : null,
        perPack: !comparableMeasure,
        replaced: from.lastDate < to.firstDate && similarNames(from.name, to.name),
        nameChange: nameDiff(from.name, to.name),
      })
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
