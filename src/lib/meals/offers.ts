import { addDays, format, setISOWeek, setISOWeekYear, startOfISOWeek } from 'date-fns'

/**
 * Fetches a store's offers for a week and normalises them. Sources and their
 * fields are documented in docs/08-veckomat.md 3.2 and 3.2.1:
 * - willys_api: Willys/Hemköp's own JSON API (all offers, ordinary prices).
 * - tjek: per-store flyers from Tjek's open API (ICA, Coop and others).
 * Server-side only (called from /api/meals/run).
 */

export interface StoreForOffers {
  store_id: string
  name: string
  chain: string | null
  external_id: string | null
  offers_source: string | null
  offers_url: string | null
}

export interface NormalizedOffer {
  ref: string
  name: string
  brand: string | null
  size_text: string | null
  offer_price: number | null
  offer_label: string | null
  qualifying_count: number | null
  ordinary_price: number | null
  compare_price_text: string | null
  max_purchase: string | null
  member_only: boolean
  loyalty_program: string | null
  category_text: string | null
  image_url: string | null
  valid_from: string | null
  valid_to: string | null
  source: 'willys_api' | 'third_party'
  source_url: string | null
  raw: unknown
}

export interface StoreOffers {
  store: StoreForOffers
  offers: NormalizedOffer[]
  error: string | null
}

const FETCH_HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Homebase/1.0)' }
const TIMEOUT_MS = 20_000

export function weekBounds(year: number, week: number): { monday: string; sunday: string } {
  const monday = startOfISOWeek(setISOWeek(setISOWeekYear(new Date(year, 0, 4), year), week))
  return { monday: format(monday, 'yyyy-MM-dd'), sunday: format(addDays(monday, 6), 'yyyy-MM-dd') }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** "24,90" → 24.9; "2 för 50" and other text → null. */
function swedishNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null
  const n = Number(value.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Willys dates are "dd/mm-yyyy". */
function willysDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = value.match(/^(\d{2})\/(\d{2})-(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function overlapsWeek(o: NormalizedOffer, monday: string, sunday: string): boolean {
  return (!o.valid_to || o.valid_to >= monday) && (!o.valid_from || o.valid_from <= sunday)
}

type Json = Record<string, unknown>

async function fetchWillys(store: StoreForOffers): Promise<NormalizedOffer[]> {
  const url =
    store.offers_url ||
    (store.external_id
      ? `https://www.${store.chain?.toLowerCase() === 'hemköp' ? 'hemkop' : 'willys'}.se/axfood/rest/v2/search/campaigns/offline?q=${encodeURIComponent(store.external_id)}&type=PERSONAL_GENERAL&page=0&size=250`
      : null)
  if (!url) throw new Error('Butiks-id saknas')
  const data = (await getJson(url)) as { results?: Json[] }
  return (data.results ?? []).map((r, i): NormalizedOffer => {
    const promo = ((r.potentialPromotions as Json[] | undefined) ?? [])[0] ?? {}
    const loyalty = promo.campaignType === 'LOYALTY'
    return {
      ref: String(i),
      name: String(r.name ?? ''),
      brand: (r.manufacturer as string) || null,
      size_text: (r.displayVolume as string) || null,
      offer_price: swedishNumber(promo.price),
      offer_label: (promo.rewardLabel as string) || (promo.cartLabel as string) || null,
      qualifying_count: typeof promo.qualifyingCount === 'number' ? promo.qualifyingCount : null,
      ordinary_price: swedishNumber(r.priceNoUnit),
      compare_price_text: (promo.comparePrice as string) || null,
      max_purchase: (promo.redeemLimitLabel as string) || null,
      member_only: loyalty,
      loyalty_program: loyalty ? (store.chain?.toLowerCase() === 'hemköp' ? 'Hemköp Klubb' : 'Willys Plus') : null,
      category_text: (r.googleAnalyticsCategory as string) || null,
      image_url: ((r.image as Json | undefined)?.url as string) || null,
      valid_from: willysDate(promo.startDate),
      valid_to: willysDate(promo.endDate),
      source: 'willys_api',
      source_url: url,
      raw: r,
    }
  })
}

async function fetchTjek(store: StoreForOffers, monday: string, sunday: string): Promise<NormalizedOffer[]> {
  if (!store.offers_url) throw new Error('Tjek-butik saknas (offers_url)')
  const catalogs = (await getJson(store.offers_url)) as Json[]
  const catalog = catalogs.find((c) => {
    const from = String(c.run_from ?? '').slice(0, 10)
    const till = String(c.run_till ?? '').slice(0, 10)
    return (!till || till >= monday) && (!from || from <= sunday)
  })
  if (!catalog) throw new Error('Inget reklamblad för veckan')

  const offers: Json[] = []
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = (await getJson(
      `https://squid-api.tjek.com/v2/offers?catalog_ids=${encodeURIComponent(String(catalog.id))}&limit=100&offset=${offset}`
    )) as Json[]
    offers.push(...page)
    if (page.length < 100) break
  }

  return offers.map((o, i): NormalizedOffer => {
    const pricing = (o.pricing as Json | undefined) ?? {}
    const quantity = (o.quantity as Json | undefined) ?? {}
    const pieces = (quantity.pieces as Json | undefined) ?? {}
    const size = (quantity.size as Json | undefined) ?? {}
    const unit = ((quantity.unit as Json | undefined)?.symbol as string) || ''
    const description = (o.description as string) || ''
    const count = typeof pieces.from === 'number' && pieces.from > 1 ? pieces.from : null
    const price = swedishNumber(pricing.price)
    const member = /stammis|medlem|medlemspris|klubbpris/i.test(description)
    const jfr = description.match(/jfr[- ]?pris[^.]*/i)?.[0] ?? null
    return {
      ref: String(i),
      name: String(o.heading ?? ''),
      brand: null,
      size_text: size.from ? `${size.from === size.to || !size.to ? size.from : `${size.from}-${size.to}`} ${unit}`.trim() : null,
      offer_price: price,
      offer_label: price != null ? (count ? `${count} för ${price} kr` : `${price} kr`) : null,
      qualifying_count: count,
      ordinary_price: swedishNumber(pricing.pre_price),
      compare_price_text: jfr,
      max_purchase: typeof pieces.max === 'number' ? `Max ${pieces.max}` : null,
      member_only: member,
      loyalty_program: member ? (store.chain?.toLowerCase() === 'coop' ? 'Coop medlem' : 'ICA Stammis') : null,
      category_text: null,
      image_url: ((o.images as Json | undefined)?.view as string) || null,
      valid_from: String(o.run_from ?? '').slice(0, 10) || null,
      valid_to: String(o.run_till ?? '').slice(0, 10) || null,
      source: 'third_party',
      source_url: store.offers_url,
      raw: { ...o, description },
    }
  })
}

/** All stores in parallel. A store that fails gets an error, never throws. */
export async function fetchOffersForWeek(stores: StoreForOffers[], year: number, week: number): Promise<StoreOffers[]> {
  const { monday, sunday } = weekBounds(year, week)
  return Promise.all(
    stores.map(async (store, storeIndex): Promise<StoreOffers> => {
      // Short refs ("A0", "B12") that Claude uses to point at an offer.
      const prefix = String.fromCharCode(65 + storeIndex)
      try {
        let offers: NormalizedOffer[]
        if (store.offers_source === 'willys_api') offers = await fetchWillys(store)
        else if (store.offers_source === 'tjek') offers = await fetchTjek(store, monday, sunday)
        else return { store, offers: [], error: 'Ingen källa som kan läsas utan webbläsare' }
        return {
          store,
          offers: offers
            .filter((o) => o.name && overlapsWeek(o, monday, sunday))
            .map((o, i) => ({ ...o, ref: `${prefix}${i}` })),
          error: null,
        }
      } catch (error) {
        return { store, offers: [], error: error instanceof Error ? error.message : 'Okänt fel' }
      }
    })
  )
}
