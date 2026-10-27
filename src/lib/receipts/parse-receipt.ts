import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

/**
 * Reads a grocery receipt (photo or PDF, e.g. shared from Kivra or the ICA
 * app) with Claude and returns its lines as structured data. Needs
 * ANTHROPIC_API_KEY in the environment.
 */

const ReceiptLineSchema = z.object({
  name: z.string().describe('Varans namn, läsbart och i normal skiftläge, t.ex. "Kycklinglårfilé" (inte "KYCKL.LÅRFILE")'),
  article_number: z.string().nullable().describe('Artikelnummer/EAN om det står på raden, annars null'),
  quantity: z.number().describe('Antal styck, eller vikt i kg/volym i liter för varor som säljs per kg/l'),
  unit: z.enum(['st', 'kg', 'l']),
  unit_price: z.number().nullable().describe('Ordinarie pris per enhet (kr/st, kr/kg, kr/l) före rabatt'),
  package_size: z
    .number()
    .nullable()
    .describe('För unit "st": hur mycket EN förpackning innehåller i package_unit (500 g → 0.5, 1,5 L → 1.5, 6-pack → 6), om det står på kvittot eller i namnet. Annars null.'),
  package_unit: z.enum(['kg', 'l', 'st']).nullable().describe('Enhet för package_size, null när package_size är null'),
  total_price: z.number().describe('Vad raden kostade efter rabatter på den, i kronor'),
  discount_amount: z.number().describe('Summan av rabatter som hör till raden (positivt tal), 0 om ingen'),
  is_deposit: z.boolean().describe('true för pant'),
})

export const ParsedReceiptSchema = z.object({
  is_receipt: z.boolean().describe('false om bilden/filen inte är ett kassakvitto'),
  store_name: z.string().nullable().describe('Butikens namn som det står, t.ex. "ICA Nära Högdalen"'),
  store_chain: z.string().nullable().describe('Kedja: ICA, Coop, Willys, Hemköp, Lidl, City Gross, Tempo … eller null'),
  store_location: z.string().nullable().describe('Ort om den framgår'),
  purchase_date: z.string().nullable().describe('Köpdatum som YYYY-MM-DD'),
  receipt_number: z.string().nullable(),
  total_amount: z.number().nullable().describe('Totalt betalt belopp i kronor'),
  lines: z.array(ReceiptLineSchema),
})

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>

const INSTRUCTIONS = `Du läser av ett svenskt kassakvitto från en livsmedelsbutik och returnerar alla köpta varor.

Regler:
- En rad per köpt vara. Ta med pant som egen rad med is_deposit = true.
- Rabatter, erbjudanden och Stammispriser som står på egen rad under en vara räknas in i den varans discount_amount, och total_price blir priset efter rabatten. Gör inga egna rader av rabatter.
- Vägda varor: quantity i kg (t.ex. 0.146), unit "kg", unit_price i kr/kg.
- Färdigpackade vägda varor (kött, ost, frukt i tråg) där vikt och kilopris står på kvittot räknas som vägda: quantity = vikten i kg, unit "kg", unit_price = kilopriset. Står bara kilopris och radbelopp: vikten = ordinarie belopp / kilopris.
- Förpackningsstorlek för styckvaror: package_size + package_unit när storleken står på kvittot eller i namnet ("Kikärter 380G" → 0.38 kg, "Ägg 6-pack" → 6 st, "iKaffe 1,5L" → 1.5 l, "6P/200ML" → 1.2 l). Storleksintervall som "9-14kg" på blöjor är ingen förpackningsstorlek. Gissa aldrig, lämna null.
- Flera av samma vara på en rad ("2 st x 24,90"): quantity 2, unit "st", unit_price 24.90.
- Ta inte med betalningsrader, moms, delsummor, totalsumma, bonus/poäng, kortnummer eller återbetalningar av kontanter som varor.
- Skriv varunamn läsbart med stor bokstav först, utan förkortningspunkter, men hitta inte på något som inte står.
- Belopp som tal i kronor med punkt som decimaltecken.
- Är det inte ett kvitto: is_receipt = false och tom lines.`

export interface ReceiptFile {
  /** Base64 without data: prefix. */
  data: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
}

export class ReceiptParseError extends Error {}

export function hasReceiptReader(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export async function parseReceipt(file: ReceiptFile): Promise<ParsedReceipt> {
  if (!hasReceiptReader()) {
    throw new ReceiptParseError('Kvittoläsning är inte aktiverad (ANTHROPIC_API_KEY saknas i Vercel).')
  }
  const client = new Anthropic()

  const source =
    file.mediaType === 'application/pdf'
      ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } } as const)
      : ({ type: 'image', source: { type: 'base64', media_type: file.mediaType, data: file.data } } as const)

  let response
  try {
    response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // A refusal (unlikely for a receipt) is retried on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(ParsedReceiptSchema) },
      messages: [{ role: 'user', content: [source, { type: 'text', text: INSTRUCTIONS }] }],
    })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new ReceiptParseError('Ogiltig ANTHROPIC_API_KEY.')
    if (error instanceof Anthropic.RateLimitError) throw new ReceiptParseError('För många förfrågningar just nu, försök igen om en stund.')
    if (error instanceof Anthropic.BadRequestError) throw new ReceiptParseError(`Filen kunde inte läsas: ${error.message}`)
    if (error instanceof Anthropic.APIError) throw new ReceiptParseError(`Claude svarade med fel ${error.status}.`)
    throw error
  }

  if (response.stop_reason === 'refusal') throw new ReceiptParseError('Kvittot kunde inte läsas av.')
  if (response.stop_reason === 'max_tokens') throw new ReceiptParseError('Kvittot var för långt för att läsas av i ett svep.')
  const parsed = response.parsed_output
  if (!parsed) throw new ReceiptParseError('Kunde inte tolka svaret från Claude.')
  if (!parsed.is_receipt) throw new ReceiptParseError('Det här ser inte ut att vara ett kassakvitto.')
  if (parsed.lines.length === 0) throw new ReceiptParseError('Hittade inga varor på kvittot.')
  return parsed
}
