# 01 — Databas

Senast uppdaterad: 2026-09-16

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
