# 09 — Veckomat: körning

Senast uppdaterad: 2026-11-03

Hur en veckomatskörning görs i Claude-chatten. Modulen, tabellerna och
JSON-kontraktet beskrivs i `08-veckomat.md`. Läs båda innan du kör.

Ordning: **1** underlag → **2** erbjudanden → **3** butiksval → **4** matsedel
→ **5** inköpslista och priser → **6** spara → **7** svara.

---

## 1. Underlag

**Startad med startprompten från appen:** underlaget är JSON-blocket i
meddelandet. Läs inte inställningarna från databasen.

**Schemalagd körning eller utan prompt:** hämta samma underlag med

```sql
SELECT public.meal_prompt_context('<user_id>');
```

Nycklarna är desamma i båda fallen:

| Nyckel | Används till |
|---|---|
| `user_id`, `year`, `iso_week` | Ägare och vecka för planen |
| `household` | Vuxna, barn, vuxenportioner per middag, middagar och matlådor per vecka |
| `diet_notes`, `avoid` | Önskemål och sådant som inte får förekomma |
| `kcal_per_adult_portion` | Kalorimål per vuxenportion (`min`/`max`, kan vara `null`) |
| `memberships` | Lojalitetsprogram. Medlemspris räknas bara för dessa |
| `pantry_staples` | Finns alltid hemma. Köps aldrig |
| `on_hand` | Finns hemma den här veckan (`text`, `updated_at`). Används först, köps inte |
| `stores` | Butikerna att jämföra: `store_id`, kedja, `external_id`, `offers_source`, `offers_url`, `online_fee` |
| `recent_dishes` | Rätter från de senaste listorna, med `recipe_id` |
| `leftovers_from_last_plan` | Det förra planen räknade med blir över. Behandla som `on_hand` om det inte motsägs |

Är `on_hand.updated_at` äldre än en vecka: använd det, men nämn i svaret att
det kan vara inaktuellt.

---

## 2. Erbjudanden

Hämta per butik i `stores` enligt `offers_source`. Fältlistor och URL:er finns
i `08-veckomat.md` 3.2.

| `offers_source` | Så här |
|---|---|
| `willys_api` | Hämta `offers_url` (JSON). Ordinarie pris i `priceNoUnit`, erbjudande i `potentialPromotions[0]`. `campaignType = LOYALTY` = Willys Plus. Datum `dd/mm-yyyy`. Hemköp har samma API |
| `ica_web` | Hämta `offers_url`. Utan JavaScript syns bara en bråkdel. Använd webbläsare om den finns. Ingen giltighetsperiod anges — anta veckan och skriv det i `notes` |
| `coop_web` | Kräver webbläsare. Utan webbläsare: hoppa över butiken och skriv det i `notes` |
| `manual` / `null` | Inga erbjudanden att hämta. Butiken kan ändå väljas med ordinarie priser |

- Filtrera bort erbjudanden som slutar före veckans måndag eller börjar efter
  söndag. Erbjudanden som bara gäller helgen är ok om de märks så.
- Medlemspriser: räkna bara med dem för program i `memberships`. Annars gäller
  ordinarie pris för den varan.
- Går en källa inte att läsa: fortsätt med de andra och skriv vilken som
  saknades i `summary.notes`. Avbryt inte körningen.

---

## 3. Butiksval

- Välj **en** butik: den som täcker flest av matsedelns huvudvaror (protein
  först) på erbjudande, vid ungefär lika täckning den billigaste totalt.
- Lägg till `online_fee` om inköpet är online.
- Skriv valet och jämförelsen i `summary.notes`, t.ex. "Willys Rissne har
  erbjudande på 15 av 21 rader, Coop ca 7, ICA ca 4".
- Butiken anges i JSON:en som `"store": {"store_id": "<store_id från underlaget>"}`.

---

## 4. Matsedel

- `household.dinners_per_week` middagar. Varje middag ger
  `household.portions_per_dinner` vuxenportioner (barnportion ≈ halv).
- Matlådor: `household.lunchboxes_per_week` kommer från 1–2 rätter i dubbel
  sats (`batch_multiplier: 2`, `lunchbox_portions` = antal lådor från rätten).
- **Använd `on_hand` och `leftovers_from_last_plan` först.** Bygg minst en rätt
  kring det som finns hemma när det går. Varor därifrån hamnar inte på
  inköpslistan; har det inte räckt, köp bara mellanskillnaden.
- Ingen rätt som finns i `recent_dishes` från föregående vecka.
  Vill du återanvända en äldre rätt: ange dess `recipe_id` och skicka inte med
  ingredienser och steg igen.
- Inget från `avoid`. Följ `diet_notes`.
- Kcal per vuxenportion inom `kcal_per_adult_portion`. Ge tips för att justera
  vid upplägg (mindre ris/pasta, mer grönsaker).
- Varje rätt: ingredienser med mängd som tal + enhet där det går
  (`amount_text` för visning), steg, tips, `kids_note`, `storage_note`.
  Ingredienser från `pantry_staples` och `on_hand` markeras `is_pantry: true`.

---

## 5. Inköpslista och priser

- En rad per vara att köpa, i hela förpackningar. Avdelningar (`section`):
  Frukt & grönt, Kött & chark, Fisk, Mejeri, Bröd, Skafferi & fryst, Övrigt.
- `dish_keys` på varje rad: de rätter varan används i.
- Pris per rad i den här ordningen. Ange källan i `price_source`:

  | Ordning | `price_source` | Källa |
  |---|---|---|
  | 1 | `offer` | Erbjudandet i vald butik (medlemspris bara för `memberships`). Sätt `is_offer: true` och `offer_label` |
  | 2 | `store_ordinary` | Butikens ordinarie pris från källan |
  | 3 | `receipt` | `SELECT * FROM public.latest_receipt_price('<vara>', '<user_id>');` — senaste kvittopris. Kvittotexter är förkortade, sök på ett kort ord ("mjölk", "gurka") |
  | 4 | `estimate` | Egen uppskattning |

- Total handling (`summary.total_cost_est`) = summan av raderna (+ ev.
  `online_fee`). Kostnad per rätt = den mängd som går åt.
- `pantry`: basvaror rätterna behöver som antas finnas hemma (från
  `pantry_staples`, plus det uppenbara).
- `leftovers`: det som blir kvar av köpta förpackningar och är värt att
  använda nästa vecka ("Potatis ca 1 kg", "Halv vitkål"). Kort, max ~6 rader.
  Hoppa över småsaker som kryddor.

---

## 6. Spara

Bygg MealPlan-JSON enligt `08-veckomat.md` 5.4 och spara i ett anrop:

```sql
SELECT public.import_meal_plan($json${ ... }$json$::jsonb, '<user_id>');
```

- Använd dollar-citat (`$json$ ... $json$`) så att apostrofer i recepten inte
  bryter SQL:en.
- `source`: `"chat"` vid startprompt, `"schedule"` vid schemalagd körning.
- `offers`: spara erbjudandena som används plus andra relevanta från vald butik
  (protein, mejeri, frukt & grönt), högst ~50. Inte hela kampanjlistan.
- Importen är allt eller inget. Felmeddelandet säger vad som är fel (okänd
  `dish_keys`, okänd butik, saknat namn). Rätta och kör igen — en misslyckad
  import lämnar inget halvskrivet.
- Namnet blir "v45", eller "v45 (2)" om det redan finns en lista med samma namn.

Kontrollera efteråt:

```sql
SELECT name, total_cost_est,
  (SELECT count(*) FROM public.meal_plan_dishes WHERE meal_plan_id = mp.id) AS dishes,
  (SELECT count(*) FROM public.shopping_list_items WHERE meal_plan_id = mp.id) AS items
FROM public.meal_plans mp WHERE id = '<id från importen>';
```

---

## 7. Svara

Kort, i chatten:

- Listans namn och att den finns under Veckomat i appen.
- Butik och varför (en mening), total kostnad och kr/portion.
- De fyra rätterna med kcal och vilka som ger matlådor.
- Vad från `on_hand` som används, och vad som saknades (källor som inte gick
  att läsa, inaktuellt `on_hand`).

Ingen HTML-artefakt behövs längre — appen visar listan.

---

## Schemalagd körning

En schemalagd uppgift i Claude-appen (Homebase-projektet), t.ex. måndag 07:00,
med texten:

> Kör veckomat schemalagt för user_id `<user_id>`. Hämta underlaget med
> `SELECT public.meal_prompt_context('<user_id>')` och följ
> docs/09-veckomat-korning.md. Sätt `source` till `"schedule"`.

Listan dyker upp i appen med "Ny"-etikett. Kräver att Supabase är kopplat i
projektet och att källorna går att läsa utan webbläsare (i dag bara Willys
fullt, se `08-veckomat.md` fas 4).
