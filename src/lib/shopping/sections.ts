// Avdelningar i inköpslistan. Samma namn som Veckomat skriver (run-plan.ts),
// plus Dryck, Hem & hygien och Barn för det som inte är middagsmat.

import { productGroup } from '@/lib/receipts/receipt-analytics'

export const SHOPPING_SECTIONS = [
  'Frukt & grönt',
  'Kött & chark',
  'Fisk',
  'Mejeri',
  'Bröd',
  'Skafferi & fryst',
  'Dryck',
  'Hem & hygien',
  'Barn',
  'Övrigt',
] as const

export type ShoppingSection = (typeof SHOPPING_SECTIONS)[number]

export const DEFAULT_SECTION: ShoppingSection = 'Övrigt'

export function isShoppingSection(value: unknown): value is ShoppingSection {
  return typeof value === 'string' && (SHOPPING_SECTIONS as readonly string[]).includes(value)
}

/** Sort position of a section; unknown sections go last, in name order. */
export function sectionRank(section: string): number {
  const i = (SHOPPING_SECTIONS as readonly string[]).indexOf(section)
  return i === -1 ? SHOPPING_SECTIONS.length : i
}

export function compareSections(a: string, b: string): number {
  return sectionRank(a) - sectionRank(b) || a.localeCompare(b, 'sv')
}

/** Group items by store section, in the order of the store. */
export function groupBySection<T extends { section: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const item of items) map.set(item.section, [...(map.get(item.section) || []), item])
  return [...map.entries()].sort((a, b) => compareSections(a[0], b[0]))
}

/** Receipt product groups (products.product_group) to list sections. */
const GROUP_TO_SECTION: Record<string, ShoppingSection> = {
  frukt: 'Frukt & grönt',
  kott: 'Kött & chark',
  fisk: 'Fisk',
  mejeri: 'Mejeri',
  brod: 'Bröd',
  skafferi: 'Skafferi & fryst',
  snacks: 'Skafferi & fryst',
  dryck: 'Dryck',
  hem: 'Hem & hygien',
  barn: 'Barn',
  blommor: 'Övrigt',
  ovrigt: 'Övrigt',
}

export function sectionForProductGroup(group: string | null | undefined): ShoppingSection | null {
  return group ? GROUP_TO_SECTION[group] ?? null : null
}

// The receipt rules put pasta, rice and flour under bread; in the store they
// are on the pantry shelves.
const BREAD = /bröd|baguette|levain|bulle|bullar|croissant|knäck|tortilla|limpa|fralla|frallor|tunnbröd|pitabröd|naan|kaka/i
const FROZEN = /fryst|frys|glass|pommes/i

// Shopping-list words the receipt rules miss. `\b` does not work next to å/ä/ö
// in JavaScript, so word edges are written as (^|[\s-]) and ($|[\s-]).
const EXTRA_RULES: Array<{ section: ShoppingSection; re: RegExp }> = [
  { section: 'Skafferi & fryst', re: /^(?:djup)?frysta?(?:$|[\s-])/i },
  { section: 'Dryck', re: /(?:^|[\s-])(?:lätt|folk|stark|alkoholfri\s)?öl(?:$|[\s-])|alkoholfri|\bipa\b|\blager\b|mineralvatten|bubbelvatten/i },
  { section: 'Frukt & grönt', re: /majs|sockerärt|rädis|purjo|fänkål|squash|rödbet|selleri|clementin|mandarin|nektarin|persika|plommon|vindruv|salladslök|örtkryddor|groddar/i },
  { section: 'Hem & hygien', re: /servett|sopsäck|soppåse|bakplåtspapper|plastfolie|hushållspapper|toapapper|toalettpapper|tvättmedel|sköljmedel|deodorant|deo\b|rakhyvel|tops|bomullspad|plåster|glödlampa/i },
]

/** A guess from the name alone, with the receipt module's rules. */
export function guessSectionFromName(name: string): ShoppingSection {
  const extra = EXTRA_RULES.find((r) => r.re.test(name))
  if (extra) return extra.section
  const group = productGroup(name).key
  if (group === 'brod' && !BREAD.test(name)) return 'Skafferi & fryst'
  if (group === 'ovrigt' && FROZEN.test(name)) return 'Skafferi & fryst'
  return GROUP_TO_SECTION[group] ?? DEFAULT_SECTION
}

/** Lookup key for a product name: lower case, single spaces. */
export function nameKey(name: string): string {
  return name.toLocaleLowerCase('sv-SE').replace(/\s+/g, ' ').trim()
}

/** Learned sections, by name key: what the household chose wins over history. */
export type SectionHints = Map<string, string>

/**
 * The section for an item name: a learned or earlier choice for the same
 * name, otherwise a guess from the name.
 */
export function suggestSection(name: string, hints: SectionHints | undefined): string {
  const key = nameKey(name)
  if (!key) return DEFAULT_SECTION
  const hit = hints?.get(key)
  if (hit) return hit
  return guessSectionFromName(key)
}

const UNIT = '(?:st|kg|g|hg|l|dl|cl|ml|pkt|paket|förp|burk|burkar|flaska|flaskor|påse|påsar|tub|ask|knippe|klase|liter|gram)'
const AMOUNT = '\\d+(?:[.,]\\d+)?'
const LEADING = new RegExp(`^(${AMOUNT}\\s*(?:x|${UNIT})?)\\s+(.+)$`, 'i')
const TRAILING = new RegExp(`^(.+?)\\s+(${AMOUNT}\\s*${UNIT}?|${AMOUNT}\\s*x)$`, 'i')

/**
 * Splits "Mjölk 2 l", "2 mjölk" or "3x avokado" into name and amount. Text
 * without an amount at the start or end is all name.
 */
export function parseItemInput(input: string): { name: string; qty_text: string | null } {
  const text = input.replace(/\s+/g, ' ').trim()
  const trailing = text.match(TRAILING)
  if (trailing) return { name: trailing[1].trim(), qty_text: trailing[2].replace(/\s*x$/i, ' st').trim() }
  const leading = text.match(LEADING)
  if (leading) return { name: leading[2].trim(), qty_text: leading[1].replace(/\s*x$/i, ' st').trim() }
  return { name: text, qty_text: null }
}
