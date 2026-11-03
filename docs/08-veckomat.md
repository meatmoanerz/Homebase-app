# 08 — Veckomat

Senast uppdaterad: 2026-11-03

Status: **fas 1–3 klara** (databas, app, körinstruktion). Kvar: fas 4–6.
Migrationer `20261102120000_meals_module.sql` och
`20261103100000_meals_pantry_on_hand.sql` är körda i live-DB. Appen: `/meals`
(listor, arkiv, startprompt, har hemma), `/meals/[id]` (rätter, recept,
inköpslista), `/meals/settings`. Kod: `src/hooks/use-meals.ts`,
`src/components/meals/`, `src/lib/meals/`. **Körningen beskrivs i
`09-veckomat-korning.md`.**

Läs `01-databas.md` innan du rör schemat.

---

## 1. Mål

Varje vecka:

1. Hämta veckans erbjudanden från hushållets butiker.
2. Välja butik.
3. Ta fram 4 middagar, varav 1–2 lagas i dubbel sats och ger totalt 6 matlådor.
4. Skapa inköpslista, recept, kalorier och kostnad.
5. Visa allt i Homebase som modulen `meals`, delad mellan Tim och Amanda.

Körningen startas på tre sätt, i den här ordningen över tid:

| Steg | Start | Var den körs |
|---|---|---|
| 1 | Tim skriver "kör veckomat" i Claude-chatten | Claude i chatten, skriver via Supabase-MCP |
| 2 | Schemalagd körning (måndag ca 07:00) | Claude scheduled task, skriver via Supabase-MCP |
| 3 | Knapp eller schema i appen | Route handler på Vercel som anropar Claude API |

Alla tre ger **samma JSON** till **samma funktion**, `import_meal_plan` (avsnitt 5).

---

## 2. Hushållsparametrar (Tims inställningar, exempel)

Värdena nedan är Tims och Amandas inställningar, sparade som data i
`meal_settings`. De är inte standardvärden i koden.

| Parameter | Värde |
|---|---|
| Hushåll | 2 vuxna + 2 små barn |
| Portioner per middag | 3 vuxenportioner (barnportion ≈ halv vuxenportion) |
| Middagar per vecka | 4 |
| Matlådor per vecka | 6, från 1–2 middagar i dubbel sats |
| Kost | Äter allt. Gärna kalorisnålare, eller rätter där kalorier kan justeras vid upplägg |
| Kalorimål | ca 500–650 kcal per vuxenportion |
| Butiker | Maxi ICA Stormarknad Solna, Stora Coop Sundby Park, Willys Rissne |
| Medlemskap | Willys Plus, ICA Stammis, Coop medlem |
| Inköp | I butik och online |

Medlemskap och övriga parametrar ligger i `meal_settings` (5.2), inte hårdkodat
i körningen. Fram till fas 2 sätts de med SQL.

---

## 3. Det som finns i dag

### 3.1 Flödet i chatten

1. **Screening:** läs erbjudanden per butik (3.2).
2. **Butiksval:** den butik som täcker flest proteiner/huvudvaror på erbjudande.
3. **Matsedel:** 4 rätter. Två lagas i dubbel sats (6 portioner = 3 middag + 3
   lådor), övriga ger 3 portioner.
4. **Inköpslista** per avdelning (Frukt & grönt, Kött & chark, Mejeri, Skafferi &
   fryst). Rad: namn, mängd, pris, erbjudandeetikett, vilka rätter.
5. **Kostnad och kalorier** enligt 3.4.
6. **Leverans:** HTML-artefakt med avbockningsbar lista och receptark.

### 3.2 Datakällor

| Butik | Källa | Utan webbläsare? | Kommentar |
|---|---|---|---|
| **Willys Rissne** (id `2187`) | `https://www.willys.se/axfood/rest/v2/search/campaigns/offline?q=2187&type=PERSONAL_GENERAL&page=0&size=250` | **Ja** | Alla erbjudanden (210 st v42) med datum och ordinarie pris |
| **Maxi ICA Stormarknad Solna** (id `1003380`) | `https://www.ica.se/erbjudanden/maxi-ica-stormarknad-solna-1003380/` | **Delvis** | Utan JS ca 14 av ~150. I webbläsare alla, med "Ord.pris", "Jmfpris", "Max köp". Ingen giltighetsperiod. Flikar "I butik"/"Online" |
| ICA online (handla.ica.se) | – | **Nej** | client_error från molnet. Onlinepris kan skilja från butik |
| **Stora Coop Sundby Park** (nr `015810`) | `https://www.coop.se/butiker-erbjudanden/stora-coop/stora-coop-sundby-park/` | **Nej** | Kräver JS. I webbläsare 67 erbjudanden v41, "Medlemspris", "Max X st/hushåll". Reklamblad: `https://dr.coop.se/Butik/015810/period/<id>/erbjudanden?c=2026-41` (kräver JS) |

**Willys-API, fält per produkt** (`results[]`):

| Fält | Innehåll |
|---|---|
| `name`, `manufacturer`, `displayVolume` | "Fläskfärs", "GARANT", "500g" |
| `priceNoUnit`, `priceUnit`, `price` | **Ordinarie pris**, "24,90" + "kr/st" |
| `potentialPromotions[0].price` | Erbjudandepris som tal (9.9) |
| `potentialPromotions[0].rewardLabel` / `cartLabel` | "9,90/st", "53,00" |
| `potentialPromotions[0].qualifyingCount` | Antal för "X för Y" |
| `potentialPromotions[0].comparePrice` | "16:50 kr/kg" |
| `potentialPromotions[0].redeemLimitLabel` | "Max 3 köp" |
| `potentialPromotions[0].campaignType` | `LOYALTY` = kräver Willys Plus, `GENERAL` = alla |
| `potentialPromotions[0].startDate` / `endDate` | "02/11-2026" (dd/mm-yyyy) |
| `potentialPromotions[0].savePrice` | "Spara 15,00 kr" |
| `offlinePromotionLowestHistoricalPrice` | Lägsta 30-dagarspris |
| `image.url` | Produktbild |

Erbjudanden har olika perioder (helg, vecka, fem veckor). Filtrera på
`endDate` >= planerad inköpsdag.

### 3.2.1 Resultat av fas 4 (2026-11-03)

Testat från en Vercel Sandbox i `iad1` (samma infrastruktur som appens
serverfunktioner) och en molnmiljö utan webbläsare.

| Källa | Från Vercel | Beslut |
|---|---|---|
| Willys-API | **200**, alla erbjudanden med ordinarie pris | Används för Willys. Hemköp har samma API (`hemkop.se/axfood/rest/...`) |
| ica.se | **403** — datacenter-IP blockeras | Används inte direkt. ICA via Tjek |
| coop.se / `external.api.coop.se/dke/offers` | Sidan svarar, men erbjudande-API:t ger tom lista för alla id som provats (`ledgerAccountNumber` 15810, `storeID` 3147) | Används inte. Coop via Tjek |
| **Tjek** (`squid-api.tjek.com/v2`, öppet API utan nyckel) | **200**. Reklamblad per butik för Willys, Hemköp, ICA (Maxi, Kvantum, Supermarket, Nära), Coop (Stora, X:-TRA), Lidl, City Gross m.fl. | **Används för ICA och Coop**, och som reserv för övriga |
| Matpriskollen | Sidan svarar; inget öppet API hittat | Används inte — Tjek täcker behovet |

**Tjek i korthet** (dealer-id för svenska kedjor):

| Kedja | dealer_id |
|---|---|
| Willys | `c371GA` |
| Hemköp | `d9b6XA` |
| ICA Maxi Stormarknad | `ca802A` |
| ICA Kvantum | `9cb4wA` |
| ICA Supermarket | `1d1dvA` |
| ICA Nära | `20d4lA` |
| Stora Coop | `6c28SD` |
| Coop | `63eeoD` |
| Coop X:-TRA | `IHDhNs` |
| Lidl | `03a7b3` |
| City Gross | `bfe5hA` |

- Hitta butiken: `GET /v2/stores?dealer_ids=<id>&r_lat=<lat>&r_lng=<lng>&r_radius=5000`
  → matcha på `street`/`city`.
- Veckans blad: `GET /v2/catalogs?store_id=<tjek store id>` → `id`, `run_from`, `run_till`, `offer_count`.
- Erbjudanden: `GET /v2/offers?catalog_ids=<id>&limit=100&offset=0` (sidvis).
- Fält: `heading`, `description` (innehåller "Max 2 st/hushåll", jämförpris,
  "Stammis Pris"/"Medlemspris"), `pricing.price`, `pricing.pre_price` (oftast
  tomt), `quantity.size` + `unit`, `quantity.pieces.from` (> 1 = "X för Y",
  `price` gäller då alla X), `quantity.pieces.max`, `run_from`/`run_till`, `images`.
- Begränsningar: bara reklambladet (Maxi ICA Solna 115, Stora Coop Sundby Park
  79 erbjudanden v45 — mot Willys-API:ts ~250), sällan ordinarie pris, och
  medlemspris syns bara i texten. Öppet men inofficiellt API: kan ändras utan
  förvarning. Spara `raw` så att fel syns.

Butikerna har `offers_source = 'tjek'` och `offers_url` =
`https://squid-api.tjek.com/v2/catalogs?store_id=<tjek store id>`. Maxi ICA
Stormarknad Solna = `wEKl4XIPqvsvQ5YE6Cbg3`, Stora Coop Sundby Park = `3327Rrs`.

### 3.3 Leveranser hittills (privata artefakter)

| Vecka | Butik | Summa | Per portion | Länk |
|---|---|---|---|---|
| v42 | Maxi ICA Solna | ca 710 kr | ca 37 kr | https://claude.ai/artifact/4xXwXWHBHJxqXAUmZnTAjU |
| v45 | Willys Rissne | ca 615 kr | ca 34 kr | https://claude.ai/artifact/W4CZrgJiBRTrHc3CeeBieu |
| v45 | Maxi ICA Solna (online) | ca 715 kr + avgift | ca 40 kr | https://claude.ai/artifact/Kx12CuSj5cLExuBWkFFJgZ |

Artefakten visar: sammanfattning (summa, kr/portion, portioner, kcal-spann) →
4 rättkort → inköpslista per avdelning med avbockning och räknare → "Har ni
hemma?" → receptark (ingredienser, steg, tips, barnportion, förvaring).
**Det är den vyn modulen ska motsvara.**

### 3.4 Beräkningsregler

- **Kcal** per vuxenportion. Barnportion = kcal / 2. Beräknat från ingredienser.
- **Kostnad per rätt** = kostnaden för den mängd som går åt (andel av förpackning).
- **Kostnad per portion** = kostnad per rätt / portioner i rätten.
- **Total handling** = summan av hela förpackningar som köps (högre än summan av
  rätterna).
- **Basvaror** (olja, salt, peppar, buljong, torkade örter, senap, chiliflakes)
  antas finnas hemma och räknas inte.
- **Avgift för onlinehandel** läggs till från `meal_settings` om inköpet är online.

### 3.5 Prisordning

Varje rad på inköpslistan får pris från första källan som finns, och källan
sparas i `price_source`:

| Ordning | `price_source` | Källa |
|---|---|---|
| 1 | `offer` | Erbjudandet. Medlemspris bara om användaren har det medlemskapet i `meal_settings`, annars ordinarie pris |
| 2 | `store_ordinary` | Butikens ordinarie pris från källan (Willys `priceNoUnit`, ICA "Ord.pris") |
| 3 | `receipt` | Senaste kvittopris (`receipt_items.unit_price`) |
| 4 | `estimate` | Claudes uppskattning |

Kvittouppslaget görs av en databasfunktion (5.3) så att alla körvägar
prioriterar likadant. `products` är tomt i dag, så uppslaget matchar på
varunamn tills produktregistret fyllts. Kvittona är nästan bara från ICA.

---

## 4. Befintligt i Homebase (verifierat 2026-11-02)

| Tabell | Relevans | Läge |
|---|---|---|
| `profiles.enabled_modules` | Modulsystem. Veckomat blir `meals` | Kod i `src/lib/onboarding/modules.ts` (`ALL_OPTIONAL_MODULES`, `MODULE_INFO`) och `src/hooks/use-modules.ts`. `NULL` = alla moduler på (Tim) |
| `partner_connections` | Delning Tim ↔ Amanda | Räcker som hushåll. Inget `household_id` |
| `stores` | 9 butiker (ICA + 1 Hemköp). Maxi ICA Solna = `88888888-8888-8888-8888-888888888888` | RLS bara ägaren. Willys Rissne och Stora Coop Sundby Park saknas. Ingen kolumn för kedjans butiks-id |
| `products`, `product_aliases` | Produktregister | 0 resp. 3 rader. RLS bara ägaren |
| `receipts`, `receipt_items` | Riktiga priser (357 rader) | RLS bara ägaren |
| `categories` | Matbudget | Koppling i senare fas |

Inga befintliga tabeller börjar med `meal`, `recipe`, `shopping` eller
`store_offer`. Inga `split_`-tabeller berörs.

---

## 5. Arkitektur

### 5.1 Ett kontrakt, en import

```
Chatt (MCP) ─┐
Schema (MCP) ─┼──> MealPlan-JSON ──> rpc import_meal_plan(payload, p_user_id) ──> tabeller ──> appen
Claude API ──┘
```

- Validerar och skriver allt i en transaktion. Returnerar `meal_plan_id`.
- **Ägaren:** från appen/Claude API används alltid `auth.uid()`; `p_user_id`
  ignoreras. Bara när `auth.uid()` saknas (MCP-körning som admin) används
  `p_user_id`. Payloaden innehåller aldrig `user_id`.
- Erbjudanden sparas i `store_offers`: de som används plus andra relevanta från
  vald butik, högst ~50 (en hel kampanjlista är 150–250 rader och för stor för
  ett anrop från chatten).

### 5.2 Tabeller

Alla nya tabeller har `user_id` och RLS enligt mönstret i `credit_cards`:
ägaren och aktiv partner (`partner_connections.status = 'active'`) får läsa,
ändra och ta bort; insert bara med eget `user_id`.

**`meal_settings`** – en rad per användare
- `adults`, `kids`, `portions_per_dinner` (3), `dinners_per_week` (4), `lunchboxes_per_week` (6)
- `diet_notes`, `avoid` (text[]), `kcal_target_min`/`kcal_target_max`
- `memberships` (text[]: `willys_plus`, `ica_stammis`, `coop_member`)
- `preferred_store_ids` (uuid[]), `online_fees` (jsonb: `{ "<store_id>": 59 }`)
- `pantry_staples` (text[]): finns alltid hemma, köps aldrig
- `on_hand` (text) + `on_hand_updated_at`: finns hemma den här veckan, används först
- `run_day`/`run_time` (oanvända, schemat ligger i Claude-appen)

**`store_offers`** – snapshot per vecka
- `store_id`, `year`, `iso_week`, `valid_from`, `valid_to`
- `name`, `brand`, `size_text`, `offer_price`, `offer_label`, `qualifying_count`
- `ordinary_price`, `compare_price_text`, `max_purchase`, `member_only` (bool), `loyalty_program`
- `category_text`, `image_url`, `source` (`willys_api` / `ica_web` / `coop_web` / `third_party` / `manual`), `source_url`, `fetched_at`, `raw` (jsonb)

**`recipes`** – bibliotek
- `name`, `description`, `base_portions`, `kcal_per_portion`, `time_text`
- `steps` (jsonb), `tips` (jsonb), `storage_note`, `kids_note`
- `tags` (text[]), `rating` (int, valfri), `times_cooked`, `last_cooked_at`, `created_by` (`claude` / `user`)

**`recipe_ingredients`**
- `recipe_id`, `sort`, `name`, `amount` (numeric), `unit`, `amount_text`, `is_pantry`, `product_id` (valfri)

**`meal_plans`** – en lista per vecka, flera kan vara synliga
- `name` (default "v45"; finns namnet redan blir det "v45 (2)"), `year`, `iso_week`, `store_id`
- `status`: `visible` / `archived`. Inga utkast
- `is_new` (bool): sätts vid import, nollas när listan öppnas
- `total_cost_est`, `cost_per_portion_est`, `portions_total`, `kcal_min`, `kcal_max`
- `notes` (källor, osäkerheter), `source` (`chat` / `schedule` / `app`), `created_at`, `archived_at`
- `pantry` (text[]): basvaror rätterna antar finns hemma
- `leftovers` (text[]): det som blir över; föreslås som "har hemma" nästa vecka
- `actual_cost`, `receipt_id` (valfria, för budgetkoppling senare)

**`meal_plan_dishes`**
- `meal_plan_id`, `recipe_id`, `sort`, `batch_multiplier` (1 / 2)
- `dinner_portions`, `lunchbox_portions`, `cost_est`, `planned_date`, `cooked_at`

**`shopping_list_items`** – Realtime påslaget
- `meal_plan_id`, `section`, `sort`, `name`, `quantity`, `unit`, `qty_text`
- `price_est`, `price_source` (3.5), `is_offer`, `offer_label`, `store_offer_id`, `store_id`
- `dish_ids` (uuid[])
- `checked`, `checked_by`, `checked_at`

**`stores`** – ändras
- Nya kolumner: `external_id` (Willys `2187`, ICA `1003380`, Coop `015810`), `offers_source`, `offers_url`
- Ny SELECT-policy: aktiv partner får läsa (ägaren behåller full rätt)
- Nya rader: Willys Rissne, Stora Coop Sundby Park

### 5.3 Funktioner

- `import_meal_plan(payload jsonb, p_user_id uuid default null) returns uuid`
  – allt eller inget; fel i payloaden (okänd `dish_keys`, okänd butik, saknat
  namn) avbryter hela importen.
- `latest_receipt_price(p_name text, p_user_id uuid default null)` – senaste
  `receipt_items.unit_price` för en vara i hushållets kvitton, matchad via
  `products.name` om koppling finns, annars på kvittotexten. Används av
  körningen för 3.5 steg 3.
- `has_feature_access(p_feature text)` – för appen, gäller inloggad användare.
- `meal_prompt_context(p_user_id uuid default null) returns jsonb` – samma
  underlag som startprompten (samma nycklar som `src/lib/meals/prompt.ts`), för
  schemalagd körning. Inställningar: egna, annars partnerns.
- `my_household_user_ids()` – inloggad användare + aktiv partner, används i RLS.
- `private.user_has_feature`, `private.household_user_ids` – tar valfritt
  user_id och används av admin-vägen. Från en klientsession svarar de bara för
  den egna användaren (`private.is_client_session()`).

Anrop från chatten (MCP, admin):

```sql
SELECT public.import_meal_plan('<MealPlan-JSON>'::jsonb, '<user_id>');
SELECT * FROM public.latest_receipt_price('mjölk', '<user_id>');
```

Payloaden kan ha `"store": {"store_id": "<uuid>"}` i stället för kedja +
`external_id`. Butiken måste finnas bland hushållets `stores`.

### 5.4 JSON-kontrakt

```json
{
  "iso_week": 45,
  "year": 2026,
  "name": "v45",
  "source": "chat",
  "store": { "store_id": "<uuid>" },
  "summary": { "total_cost_est": 615, "cost_per_portion_est": 34, "portions_total": 18,
               "kcal_min": 480, "kcal_max": 640,
               "notes": "Coop ej läsbar denna vecka. Ordinarie priser delvis uppskattade." },
  "offers": [
    { "name": "Fläskfärs", "brand": "GARANT", "size_text": "500g", "offer_price": 34.9,
      "offer_label": "34,90 kr/st", "ordinary_price": 49.9, "valid_from": "2026-11-02",
      "valid_to": "2026-11-08", "member_only": false, "source": "willys_api" }
  ],
  "dishes": [
    { "key": "wok", "recipe_id": null,
      "name": "Fläskfärswok med vitkål, morötter och nudlar",
      "batch_multiplier": 2, "dinner_portions": 3, "lunchbox_portions": 3,
      "kcal_per_portion": 640, "cost_est": 165, "time_text": "25 min",
      "ingredients": [ { "name": "Fläskfärs", "amount": 1000, "unit": "g",
                         "amount_text": "1 kg (2 förp à 500 g)", "is_pantry": false } ],
      "steps": ["..."], "tips": ["..."], "kids_note": "...", "storage_note": "..." }
  ],
  "shopping_list": [
    { "section": "Kött & chark", "name": "Fläskfärs, Garant, 500 g", "quantity": 2, "unit": "förp",
      "qty_text": "2 förp", "price_est": 69.8, "price_source": "offer", "is_offer": true,
      "offer_label": "34,90 kr/st", "dish_keys": ["wok"] }
  ],
  "pantry": ["Olja", "Salt", "Peppar", "Grönsaksbuljong"],
  "leftovers": ["Potatis ca 1 kg", "Halv vitkål"]
}
```

- `store`: `{"store_id": ...}` eller `{"chain": ..., "external_id": ...}`.

- `recipe_id` satt = återanvänd recept ur biblioteket. `null` = nytt recept
  skapas. Ingen matchning på namn. Körningen läser biblioteket först och
  återanvänder med avsikt.
- `dish_keys` binder inköpsrader till rätter inom samma payload.

### 5.5 Säkerhet

- RLS på alla nya tabeller (5.2).
- MCP-körning skriver som admin via RPC med `p_user_id` = den som beställer
  körningen (för Tim: `b8a41ea4-66f5-4869-98f1-2fe06c4423f3`, se `01-databas.md`).
  Id:t står i körinstruktionen, aldrig i appkoden.
- Claude API-nyckeln finns bara server-side (route handler på Vercel), aldrig i
  klienten eller Capacitor-bygget.

### 5.6 Inget hårdkodat, byggt för alla användare

- Appkod, migrationer och funktioner innehåller inga användar-id, namn, e-post,
  butiker eller hushållsparametrar. Allt sådant är data per användare
  (`meal_settings`, `stores`, `profiles`).
- Nya användare utgår från tomma inställningar och fyller i dem i appen.
  Rimliga standardvärden (t.ex. 4 middagar) får finnas som kolumn-default, men
  inget som är specifikt för ett hushåll.
- Delning sker bara via `partner_connections`, aldrig via namngivna konton.

### 5.7 Åtkomst under beta

Så länge körningen görs av Claude-chatten (fas 1–4) är modulen låst. Ingen
inloggad användare kan starta en körning själv, och ingen ska se en modul som
inte fungerar för dem.

- Ny kolumn `profiles.feature_access text[] NOT NULL DEFAULT '{}'`.
- Funktion `has_feature_access(p_user_id uuid, p_feature text) returns boolean`:
  sant om `p_feature` finns i `feature_access`, **eller** om användarens e-post
  i `auth.users` slutar på `@test.se`.
- Tim och Amanda får `'meals'` i `feature_access` med en SQL-uppdatering
  (data, inte kod).
- Appen: modulen `meals` visas i modulvalet, menyn och på `/meals` bara om
  `has_feature_access` är sant. Annars syns den inte alls.
- `import_meal_plan` avbryter om ägaren saknar åtkomst.
- När körning via Claude API finns (fas 5) tas spärren bort: `has_feature_access`
  returnerar sant för `meals` för alla, eller så tas anropen bort.

### 5.8 Vyer i appen (MVP)

1. **Listor:** alla synliga listor, nyast först, med "Ny"-etikett. Arkivet
   längst ner, går att fälla ut.
2. **Arkiveringsfråga:** banner överst när det finns synliga listor från veckor
   som passerat: *"2 äldre listor (v42, v43). Arkivera?"* — **Arkivera** /
   **Inte nu**. "Inte nu" döljer bannern tills nästa lista importeras. Ingen
   popup.
3. **En lista:** sammanfattning (summa, kr/portion, portioner, kcal-spann, butik,
   källnoteringar) → rättkort → receptvy → inköpslista per avdelning med
   avbockning i realtid, "x av y", "Har ni hemma?". Pris visar källa
   (erbjudande / ordinarie / kvitto / uppskattat).
4. **Arkiverad lista:** går att läsa, bocka av och återställa.
5. **Inställningar:** hushåll, kalorimål, önskemål, undvik, basvaror,
   medlemskap, butiker och onlineavgift.
6. **Startprompt (fas 2):** en liten textruta med kopieringsknapp på
   veckomatsidan. Texten genereras från användarens inställningar och klistras
   in i Claude-chatten (Homebase-projektet) för att starta en körning. Den
   innehåller allt körningen behöver, så att chatten inte läser inställningar
   från databasen: user_id, år och vecka, hushåll och portioner, middagar och
   matlådor, kostnoteringar, kalorimål, medlemskap, butiker (namn, kedja,
   `external_id`, källa, URL, onlineavgift) och de senaste veckornas rätter
   (namn + `recipe_id`) för att undvika upprepning och kunna återanvända recept,
   basvaror, "har hemma" och förra planens rester. Rutan behöver inte vara
   läsbar, bara kopierbar.
7. **Har hemma just nu:** fält under startprompten. Visar när det ändrades,
   varnar efter en vecka och föreslår förra planens `leftovers` som knappar.

Senare: byt ut en rätt (Claude API), skala portioner, betyg/favoriter, plan
mot kvitto, koppling till matbudget.

---

## 6. Byggordning

| Fas | Innehåll | Klar när |
|---|---|---|
| 1 | Migration: tabeller, RLS, `stores`-ändringar, `feature_access` + `has_feature_access`, `import_meal_plan`, `latest_receipt_price`. Data: `meal_settings` och `feature_access` för Tim och Amanda | v45-data importerad via RPC och läsbar som både Tim och Amanda (testat i BEGIN/ROLLBACK först) |
| 2 | Modul `meals` i appen: listor, arkivering, rätter, recept, inköpslista med realtime, inställningar | Samma innehåll som artefakten syns i appen |
| 3 ✓ | Körinstruktion (`09-veckomat-korning.md`), `meal_prompt_context` för schemalagd körning, basvaror och har hemma | "Kör veckomat" i chatten ger en ny lista i appen |
| 4 ✓ | Spike: ICA/Coop utan webbläsare, tredjepartskällor, Willys från Vercel (3.2.1) | Willys-API för Willys/Hemköp, Tjek för ICA/Coop och övriga |
| 5 | Körning i appen via Claude API | Knapp i appen skapar en lista |
| 6 | Kvittopriser via produktregister, byt rätt, betyg, budgetkoppling | – |

---

## 7. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Hushållsmodell | `user_id` + aktiv partner via `partner_connections`, som `credit_cards` |
| 2 | Recept | Bibliotek (`recipes`), återanvänds via `recipe_id`, ingen namnmatchning |
| 3 | Ingredienser | Tal + enhet där det går, `amount_text` för visning |
| 4 | Schema | Måndag ca 07:00. Ger en ny synlig lista med "Ny"-etikett |
| 5 | Butiksläge | Jämför de butiker som går att läsa, föreslå en, visa skillnaden. Willys + ICA delvis tills fas 4 |
| 6 | ICA/Coop | Via Tjek (3.2.1). Willys och Hemköp via eget API |
| 7 | Priser | Prisordning 3.5, källa per rad |
| 8 | Medlemspriser | Styrs av `meal_settings.memberships` per användare |
| 9 | Onlinehandel | Avgift i `meal_settings` |
| 10 | Var modulen syns | Modul `meals` via `enabled_modules` |
| 11 | Budget | Senare fas. `actual_cost` och `receipt_id` finns från start |
| 12 | Upprepning | Ingen rätt två veckor i rad. Prioritera högt betyg |
| 13 | Kalorier | Visa per vuxen- och barnportion, mål 500–650 kcal |
| 14 | Listor | Flera synliga samtidigt, namn "v45". Användaren arkiverar själv efter fråga i banner. Inga utkast |
| 15 | `stores` och kvitton | Partner får läsrätt på `stores`, `receipts`, `receipt_items`, `products`, `product_aliases`. Ändringar bara på egna rader |
| 16 | Hårdkodning | Inga användare, butiker eller hushållsvärden i kod. Allt är data per användare (5.6) |
| 17 | Åtkomst | Låst till `feature_access` + `@test.se`-konton tills Claude API-körning finns (5.7) |

---

## 8. Risker

- **Skrapning kan sluta fungera** när butiker ändrar sidor. `raw` och `source`
  sparas per erbjudande så att fel syns.
- **Kalorier och uppskattade priser** är ungefärliga. Appen visar priskälla.
- **Erbjudanden har olika perioder.** Filtrera på inköpsdag.
- **Live-DB delas med Zplitta.** Rör inga `split_`-tabeller.
