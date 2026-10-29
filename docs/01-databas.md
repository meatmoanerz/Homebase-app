# 01 — Databas

Senast uppdaterad: 2026-10-29

## Projekt

Live-DB: Supabase-projektet **`ziplastiwvjcfrtjihwj`** ("Stacka-app"). Det enda
projekt live-appen läser och skriver mot.

**`elgjvpaisyastvbzvvof`** ("Homebase") är dött. Det innehåller gamla
`stacka_*`-prefixade tabeller och används inte av appen. Skriv aldrig till det.
Det har hänt av misstag tidigare. Verifiera aktivt projekt mot repots env-config
om du är minsta osäker.

Tims `user_id`: `b8a41ea4-66f5-4869-98f1-2fe06c4423f3`
Allt data är per `user_id` (uuid).

## Tabeller

`expenses`, `categories`, `category_mappings`, `import_staging`,
`recurring_expenses`, `receipts`, `receipt_items`, `budget_item_assignments`,
`shared_account_defaults`, `push_subscriptions`, `notification_settings`,
`keepalive`.

Zplitta använder `split_`-prefixade tabeller i samma projekt. Rör dem inte vid
Homebase-arbete.

---

## `expenses`

Nyckelkolumner:

| Kolumn | Typ | Noter |
|---|---|---|
| `cost_assignment` | text | `'personal'` / `'shared'` / `'partner'` |
| `is_ccm` | bool | true för Amex, se 02-csv-import.md |
| `bank` | text | `'SEB'` / `'Swedbank'` / `'Amex'` |
| `date` | date | transaktionsdatum |
| `is_refund` | bool | krävs för negativa belopp |
| `is_group_purchase` | bool | utlägg |
| `group_purchase_total` | numeric | korttotal vid utlägg |
| `import_source` | text | `'csv'` = fil inläst i appen eller av Claude (AI-import), `'auto'` = Era/Wallet (bara historisk backfill), NULL = manuell eller auto-synk. Importsidans "senaste datum från bankfil" läser bara `'csv'` — sätt det vid SQL-insert direkt i `expenses` |

### Check constraint `expenses_amount_check`

```
amount > 0
OR (is_group_purchase AND amount >= 0)
OR (is_refund AND amount < 0)
```

Returer och krediteringar MÅSTE ha `is_refund = true` för att ett negativt
belopp ska släppas igenom. Annars kastas constraint-fel och hela statementet
rullas tillbaka.

### Fördelning mellan Tim och Amanda

Härleds från `cost_assignment`. Det finns inga andel-kolumner per person i
`expenses` och de ska inte skapas. Budget per person drivs istället av tabellen
`budget_item_assignments` — dela aldrig alla belopp 50/50 rakt av.

---

## Kvitton (`receipts`, `receipt_items`, `products`, `stores`, `product_aliases`)

- `receipt_items.total_price` är efter rabatt, `discount_amount` positivt,
  `unit_price` ordinarie pris per st/kg. Vägda varor (även färdigpackat med
  kilopris): `quantity` i kg.
- `receipt_items.package_size` + `package_unit` (`kg`/`l`/`st`): vad EN
  `quantity` innehåller. Vägda varor `1, 'kg'`; "Ägg 6-pack" `6, 'st'`;
  okänd storlek `NULL, NULL` (då jämförs priset bara inom samma artikel).
  Båda NULL eller båda satta (check-constraint).
- Produkt = det man köper ("Smör"); artikel = butikens artikelnummer
  ("Smör NS 82%"). Flera artiklar kopplas till samma `product_id`. Pant
  kopplas aldrig till en produkt.
- `products.product_group` (text, NULL = gissas från namnet): `barn`, `fisk`,
  `snacks`, `kott`, `mejeri`, `frukt`, `brod`, `dryck`, `skafferi`, `hem`,
  `blommor`, `ovrigt`.
- Inläsning via appen sker i `src/lib/receipts/save-receipt.ts`; samma regler
  gäller vid SQL-insert (sätt `user_id` på alla rader, koppla
  `receipts.expense_id` om köpet finns).

---

## Sparmål (`savings_goals`, `savings_goal_contributions`)

- En utgift i ett sparmåls kategori (`categories.linked_savings_goal_id`) får sitt
  bidrag av triggern på `expenses` — vid insert och när kategori, belopp,
  `cost_assignment` eller `user_id` ändras. **Lägg aldrig in bidrag för utgifter
  manuellt.**
- `starting_balance` och `starting_balance_user1/2` räknas fram av trigger.
  Skriv bara `initial_balance` ("Redan sparat").
- Uttag = rad i `savings_goal_contributions` utan `expense_id`, negativt `amount`,
  `date` satt. user1 = målets ägare, user2 = ägarens partner.

## Hushållsmodell (`shared_account_defaults`)

Gäller från `effective_from` och framåt (senaste raden ≤ perioden). `model`:
`'budget'` / `'income'` / `'equal'`. `category_ids` = gemensamma kostnader,
`income_category_ids` = de som delas efter inkomst, `excluded_income_names` =
inkomster som inte räknas. Beräkningarna finns i `src/lib/household/economy.ts`.

---

## `category_mappings`

| Kolumn | Noter |
|---|---|
| `pattern` | söksträngen |
| `match_type` | `'contains'` / `'starts_with'` / `'exact'` |
| `cost_assignment` | default för matchande rader |
| `bank` | begränsar regeln till en bank |
| `priority` | högre vinner |
| `hit_count` | räknare |

Vid matchning: sortera alltid `ORDER BY priority DESC, hit_count DESC`.

### Merchant-regler som saknas (kandidater)

BUFFERT, K*ENTREN, K*LJUGARNS S, VFI*KATTHAMMARSV, Podme, HEMSE, Babyshop,
INCHARGEABSWEDEN, K*PRIME VIDE, AEA, FLYSAS, K*TV4, BILTEMA,
PADDLE.NET* RUNNA, ANTHROPIC* CLAUDE SUB

---

## `import_staging`

Mellanlagring för AI-import. Tim granskar och godkänner i appen.

### `batch_id` — vanligaste felkällan

Måste vara **ett gemensamt UUID för alla rader i batchen**:

```sql
WITH b AS (SELECT gen_random_uuid() AS id)
INSERT INTO import_staging (batch_id, ...)
SELECT b.id, ...
FROM (VALUES (...), (...)) AS v(...)
CROSS JOIN b;
```

Skriver du `gen_random_uuid()` inline i VALUES får varje rad ett eget UUID —
varje rad blir sin egen batch och granskningsvyn går sönder.

### Övriga krav

- `match_source` är NOT NULL. Sätt `'mappning'` eller `'blank'`.
- `expires_at = now() + interval '48 hours'`. Utgångna batchar måste byggas om
  helt från grunden — de går inte att återuppliva.

### Utläggskolumner

`is_group_purchase`, `group_purchase_user_share`, `group_purchase_partner_share`,
`group_purchase_swish_recipient` (`'user'` / `'partner'` / `'shared'`).

Rent utlägg = båda shares 0.

---

## SQL-arbetsflöde

- **Schemaändringar:** kör som migration, idempotent med `IF NOT EXISTS`.
  RLS-policies i samma migration som tabellskapandet.
- **Testning:** `BEGIN` ... `ROLLBACK` för att verifiera utan att skriva.
- **Verifiering:** fråga alltid live-data för att se faktiskt läge innan du
  skriver fixkod.
- **Atomicitet:** multi-row INSERT är allt-eller-inget. Bryter en rad mot en
  constraint rullas hela statementet tillbaka. Kör därför schemamigrationer
  innan du lägger in data som beror på dem.
