import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchOffersForWeek, type NormalizedOffer, type StoreForOffers, type StoreOffers } from '@/lib/meals/offers'

/**
 * Veckomat run started from the app (fas 5): context → offers → receipt
 * prices → one Claude call with a structured answer → import_meal_plan.
 * Same rules as a chat run (docs/09-veckomat-korning.md). Server-side only,
 * with a service-role client; the caller has already checked the user.
 */

export const MEAL_RUN_MODEL = 'claude-opus-5-5'

// The meal tables are not in the generated types; keep queries locally typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

const IngredientSchema = z.object({
  name: z.string(),
  amount: z.number().nullable().describe('Mängd som tal, null om den inte går att ange'),
  unit: z.string().nullable().describe('g, kg, dl, l, st, msk, tsk, burk, förp …'),
  amount_text: z.string().nullable().describe('Mängden som den ska visas, t.ex. "ca 1 kg (2 förp à 500 g)"'),
  is_pantry: z.boolean().describe('true för basvaror och sådant som finns hemma (pantry_staples, on_hand)'),
})

const DishSchema = z.object({
  key: z.string().describe('Kort unik nyckel, t.ex. "wok"'),
  recipe_id: z.string().nullable().describe('recipe_id från recent_dishes för att återanvända ett äldre recept, annars null'),
  name: z.string(),
  batch_multiplier: z.number().describe('1, eller 2 för dubbel sats'),
  dinner_portions: z.number(),
  lunchbox_portions: z.number(),
  kcal_per_portion: z.number().describe('Per vuxenportion'),
  cost_est: z.number().describe('Kostnad för det som går åt i rätten, kr'),
  time_text: z.string(),
  tags: z.array(z.string()),
  ingredients: z.array(IngredientSchema),
  steps: z.array(z.string()),
  tips: z.array(z.string()).describe('Bl.a. hur kalorierna kan justeras vid upplägg'),
  kids_note: z.string().nullable(),
  storage_note: z.string().nullable(),
})

const ItemSchema = z.object({
  section: z.enum(['Frukt & grönt', 'Kött & chark', 'Fisk', 'Mejeri', 'Bröd', 'Skafferi & fryst', 'Övrigt']),
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  qty_text: z.string().nullable(),
  price_est: z.number().nullable().describe('Pris för hela raden, kr'),
  price_source: z.enum(['offer', 'store_ordinary', 'receipt', 'estimate']),
  is_offer: z.boolean(),
  offer_label: z.string().nullable(),
  offer_ref: z.string().nullable().describe('ref för erbjudandet raden bygger på, annars null'),
  dish_keys: z.array(z.string()),
})

export const PlanOutputSchema = z.object({
  store_id: z.string().describe('store_id för vald butik'),
  summary: z.object({
    total_cost_est: z.number(),
    cost_per_portion_est: z.number(),
    portions_total: z.number(),
    kcal_min: z.number(),
    kcal_max: z.number(),
    notes: z.string().describe('Butiksval och jämförelse, källor som saknades, osäkerheter'),
  }),
  dishes: z.array(DishSchema),
  shopping_list: z.array(ItemSchema),
  pantry: z.array(z.string()),
  leftovers: z.array(z.string()).describe('Det som blir kvar och är värt att använda nästa vecka, max ~6'),
  relevant_offer_refs: z.array(z.string()).describe('Andra relevanta erbjudanden i vald butik att spara (protein, mejeri, frukt & grönt), max 40'),
})

export type PlanOutput = z.infer<typeof PlanOutputSchema>

export class MealRunError extends Error {}

const SYSTEM = `Du planerar veckans middagar för ett svenskt hushåll i appen Homebase, utifrån veckans erbjudanden i deras butiker.

Regler:
- Välj EN butik: den som täcker flest av matsedelns huvudvaror (protein först) på erbjudande; vid ungefär lika täckning den billigaste totalt. Lägg till online_fee om den finns. Skriv valet och jämförelsen mot de andra butikerna i summary.notes.
- household.dinners_per_week middagar. Varje middag ger household.portions_per_dinner vuxenportioner (barnportion ≈ halv). household.lunchboxes_per_week matlådor kommer från 1–2 rätter i dubbel sats (batch_multiplier 2, lunchbox_portions = antal lådor från rätten).
- Använd on_hand och leftovers_from_last_plan först, bygg gärna en rätt kring dem. De köps inte (köp bara mellanskillnaden om det inte räcker). pantry_staples köps aldrig. Är on_hand.updated_at äldre än en vecka: använd det men nämn det i notes.
- Ingen rätt som finns i recent_dishes från föregående vecka. Återanvänd gärna ett äldre recept genom att sätta recipe_id (då räcker name, portioner och kostnad; ingredienser och steg kan vara tomma listor).
- Inget från avoid. Följ diet_notes. Kcal per vuxenportion inom kcal_per_adult_portion; ge tips för att justera vid upplägg.
- Varje ny rätt: ingredienser med mängd som tal + enhet där det går, tydliga steg, tips, kids_note och storage_note.
- Inköpslistan: en rad per vara i hela förpackningar, dish_keys på varje rad. Ingenting från pantry_staples eller on_hand.
- Pris per rad i ordningen: (1) erbjudande i vald butik – offer, is_offer true, offer_label och offer_ref; medlemspris (member) bara om programmet finns i memberships, annars ordinarie pris; (2) butikens ordinarie pris om det finns – store_ordinary; (3) senaste kvittopris från listan – receipt; (4) egen uppskattning – estimate. "X för Y"-erbjudanden: priset gäller X st.
- summary.total_cost_est = summan av inköpsraderna (+ ev. online_fee). portions_total = alla portioner inkl. matlådor.
- Svara på svenska.`

function compactOffers(storeOffers: StoreOffers[]): string {
  return storeOffers
    .map(({ store, offers, error }) => {
      const head = `### ${store.name} (store_id ${store.store_id}, ${store.chain ?? ''})`
      if (error) return `${head}\nKunde inte läsas: ${error}`
      if (offers.length === 0) return `${head}\nInga erbjudanden för veckan.`
      const lines = offers.map((o) =>
        [
          o.ref,
          o.name,
          o.brand ?? '',
          o.size_text ?? '',
          o.offer_label ?? (o.offer_price != null ? `${o.offer_price} kr` : ''),
          o.ordinary_price != null ? `ord ${o.ordinary_price}` : '',
          o.member_only ? `member:${o.loyalty_program ?? 'ja'}` : '',
          o.max_purchase ?? '',
          o.compare_price_text ?? '',
          o.valid_to ? `t.o.m. ${o.valid_to}` : '',
        ]
          .join(' | ')
          .replace(/( \| )+$/, '')
      )
      return `${head}\nref | namn | märke | storlek | erbjudande | ordinarie | medlem | max | jämförpris | giltig\n${lines.join('\n')}`
    })
    .join('\n\n')
}

async function householdIds(admin: Admin, userId: string): Promise<string[]> {
  const { data } = await admin
    .from('partner_connections')
    .select('user1_id, user2_id')
    .eq('status', 'active')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
  const ids = new Set([userId])
  for (const r of (data ?? []) as { user1_id: string; user2_id: string }[]) {
    ids.add(r.user1_id)
    ids.add(r.user2_id)
  }
  return [...ids]
}

/** Latest receipt price per article text in the household's receipts. */
async function recentReceiptPrices(admin: Admin, userIds: string[]): Promise<string> {
  const { data } = await admin
    .from('receipt_items')
    .select('raw_name, unit_price, is_deposit, receipt:receipts(purchase_date, store:stores(chain))')
    .in('user_id', userIds)
    .gt('unit_price', 0)
    .limit(3000)
  type Row = { raw_name: string; unit_price: number; is_deposit: boolean; receipt: { purchase_date: string; store: { chain: string | null } | null } | null }
  const latest = new Map<string, Row>()
  for (const r of (data ?? []) as unknown as Row[]) {
    if (r.is_deposit || !r.receipt) continue
    const key = r.raw_name.toLowerCase()
    const cur = latest.get(key)
    if (!cur || (cur.receipt && r.receipt.purchase_date > cur.receipt.purchase_date)) latest.set(key, r)
  }
  const rows = [...latest.values()]
    .sort((a, b) => (b.receipt!.purchase_date > a.receipt!.purchase_date ? 1 : -1))
    .slice(0, 400)
  if (rows.length === 0) return 'Inga kvitton.'
  return rows.map((r) => `${r.raw_name} | ${r.unit_price} kr | ${r.receipt!.purchase_date} | ${r.receipt!.store?.chain ?? ''}`).join('\n')
}

function offerForImport(o: NormalizedOffer) {
  const { ref: _ref, ...rest } = o
  void _ref
  return rest
}

export interface MealRunResult {
  mealPlanId: string
  sources: { store: string; source: string | null; offers: number; error: string | null }[]
  inputTokens: number
  outputTokens: number
}

export async function runMealPlan(admin: Admin, userId: string): Promise<MealRunResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new MealRunError('ANTHROPIC_API_KEY saknas i Vercel.')

  const { data: context, error: ctxError } = await admin.rpc('meal_prompt_context', { p_user_id: userId })
  if (ctxError || !context) throw new MealRunError(ctxError?.message.includes('inställningar') ? 'Ställ in hushållet under Inställningar först.' : 'Kunde inte läsa inställningarna.')
  const ctx = context as { year: number; iso_week: number; stores: StoreForOffers[] }
  if (!ctx.stores?.length) throw new MealRunError('Välj minst en butik under Inställningar.')

  const [storeOffers, receiptPrices] = await Promise.all([
    fetchOffersForWeek(ctx.stores, ctx.year, ctx.iso_week),
    householdIds(admin, userId).then((ids) => recentReceiptPrices(admin, ids)),
  ])
  const sources = storeOffers.map((s) => ({ store: s.store.name, source: s.store.offers_source, offers: s.offers.length, error: s.error }))
  if (storeOffers.every((s) => s.offers.length === 0)) {
    throw new MealRunError(`Inga erbjudanden kunde hämtas (${sources.map((s) => `${s.store}: ${s.error ?? '0 st'}`).join('; ')}).`)
  }

  const userContent = [
    'Underlag (hushåll och inställningar):',
    '```json',
    JSON.stringify(context, null, 2),
    '```',
    '',
    `Veckans erbjudanden (v${ctx.iso_week} ${ctx.year}):`,
    compactOffers(storeOffers),
    '',
    'Senaste kvittopris per vara (kvittotext | pris per st/kg | datum | kedja):',
    receiptPrices,
    '',
    'Gör veckans matsedel enligt reglerna.',
  ].join('\n')

  const client = new Anthropic()
  let message
  try {
    const stream = client.beta.messages.stream({
      model: MEAL_RUN_MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: {
        effort: 'medium',
        format: betaZodOutputFormat(PlanOutputSchema),
      },
      messages: [{ role: 'user', content: userContent }],
    })
    message = await stream.finalMessage()
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new MealRunError('Ogiltig ANTHROPIC_API_KEY.')
    if (error instanceof Anthropic.RateLimitError) throw new MealRunError('För många förfrågningar till Claude just nu, försök igen om en stund.')
    if (error instanceof Anthropic.APIError) throw new MealRunError(`Claude svarade med fel ${error.status}: ${error.message}`)
    throw error
  }

  if (message.stop_reason === 'refusal') throw new MealRunError('Claude avböjde att göra matsedeln.')
  if (message.stop_reason === 'max_tokens') throw new MealRunError('Svaret blev för långt. Försök igen.')
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  let plan: PlanOutput
  try {
    plan = PlanOutputSchema.parse(JSON.parse(text))
  } catch {
    throw new MealRunError('Kunde inte tolka svaret från Claude.')
  }

  const chosen = storeOffers.find((s) => s.store.store_id === plan.store_id)
  if (!chosen) throw new MealRunError('Claude valde en butik som inte finns bland dina.')
  const byRef = new Map(chosen.offers.map((o) => [o.ref, o]))
  const usedRefs = plan.shopping_list.map((i) => i.offer_ref).filter((r): r is string => !!r && byRef.has(r))
  const keepRefs = [...new Set([...usedRefs, ...plan.relevant_offer_refs.filter((r) => byRef.has(r))])].slice(0, 50)

  const payload = {
    year: ctx.year,
    iso_week: ctx.iso_week,
    source: 'app',
    store: { store_id: plan.store_id },
    summary: plan.summary,
    dishes: plan.dishes,
    shopping_list: plan.shopping_list.map(({ offer_ref: _ref, ...item }) => {
      void _ref
      return item
    }),
    pantry: plan.pantry,
    leftovers: plan.leftovers,
    offers: keepRefs.map((r) => offerForImport(byRef.get(r)!)),
  }

  const { data: planId, error: importError } = await admin.rpc('import_meal_plan', { payload, p_user_id: userId })
  if (importError || !planId) throw new MealRunError(`Matsedeln kunde inte sparas: ${importError?.message ?? 'okänt fel'}`)

  return {
    mealPlanId: planId as string,
    sources,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  }
}
