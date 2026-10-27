# 06 — Kvitton

Senast uppdaterad: 2026-10-27

## Flödet

Tim delar ett kvitto (foto, skärmdump eller PDF från Kivra/ICA-appen) till
Claude-appen, i projektet där den här dokumentationen ligger, med t.ex.
"spara kvittot". Du läser av kvittot och sparar det i Homebase med SQL-mallen
nedan. Ingen API-nyckel behövs för det här flödet.

(Alternativt, om `ANTHROPIC_API_KEY` finns i Vercel: knappen **Läs in kvitto**
i appen eller genvägen till `/api/receipts/ingest` gör samma sak automatiskt,
se `src/lib/receipts/`.)

---

## Läsa av kvittot

En rad per köpt vara:

| Fält | Regel |
|---|---|
| `raw_name` | Varans namn, läsbart, stor bokstav först ("Kycklinglårfilé", inte "KYCKL.LÅRFILE"). Hitta inte på. |
| `article_number` | Artikelnummer/EAN om det står, annars `NULL` |
| `quantity` | Antal st, eller vikt i kg för vägda varor (t.ex. `0.146`) |
| `unit_price` | Ordinarie pris per st/kg före rabatt |
| `total_price` | Vad raden kostade **efter** rabatt |
| `discount_amount` | Rabatter som hör till raden, **positivt** tal, annars `0` |
| `is_deposit` | `true` för pant |

- Rabatt-/Stammisrader under en vara räknas in i varans `discount_amount` och
  dras från `total_price`. Gör inga egna rabattrader.
- Ta inte med betalning, moms, delsumma, totalsumma, bonus eller kortrader.
- Summan av `total_price` ska stämma med kvittots total (±2 kr). Stämmer den
  inte: säg det till Tim innan du sparar.

---

## Spara — en SQL-sats

Kör mot `ziplastiwvjcfrtjihwj`. Byt bara ut värdena i `input` och `lines`.
Satsen:

- återanvänder butiken (samma namn) eller skapar den,
- gör ingenting om kvittot redan finns (samma dag + total + butik),
- kopplar varor till produkter via artikelnummer, alias eller namn,
- kopplar kvittot till kort-/bankköpet (belopp ±1 kr, datum ±2 dagar).

```sql
WITH input AS (
  SELECT 'b8a41ea4-66f5-4869-98f1-2fe06c4423f3'::uuid AS uid,
         'ICA Nära Högdalen'::text AS store_name, 'ICA'::text AS chain, 'Stockholm'::text AS location,
         DATE '2026-10-22' AS purchase_date, '53'::text AS receipt_number, 612.40::numeric AS total
),
lines AS (
  SELECT * FROM (VALUES
    -- raw_name, article_number, quantity, unit_price, total_price, discount_amount, is_deposit
    ('Smör', '2178427', 1, 58.00, 58.00, 0, false),
    ('Manchego Reserva', NULL, 0.146, 510.00, 74.46, 0, false),
    ('Pant', NULL, 1, 2.00, 2.00, 0, true)
  ) v(raw_name, article_number, quantity, unit_price, total_price, discount_amount, is_deposit)
),
dup AS (
  SELECT r.id FROM public.receipts r
  JOIN input i ON r.user_id = i.uid AND r.purchase_date = i.purchase_date AND r.total_amount = i.total
  JOIN public.stores s ON s.id = r.store_id AND lower(s.name) = lower(i.store_name)
),
existing_store AS (
  SELECT s.id FROM public.stores s JOIN input i ON s.user_id = i.uid AND lower(s.name) = lower(i.store_name) LIMIT 1
),
new_store AS (
  INSERT INTO public.stores (user_id, name, chain, location)
  SELECT uid, store_name, chain, location FROM input
  WHERE NOT EXISTS (SELECT 1 FROM existing_store) AND NOT EXISTS (SELECT 1 FROM dup)
  RETURNING id
),
store AS (SELECT id FROM existing_store UNION ALL SELECT id FROM new_store),
expense AS (
  SELECT e.id FROM public.expenses e JOIN input i ON e.user_id = i.uid
  WHERE abs(e.amount - i.total) <= 1 AND abs(e.date - i.purchase_date) <= 2
    AND NOT EXISTS (SELECT 1 FROM public.receipts r WHERE r.expense_id = e.id)
  ORDER BY abs(e.date - (SELECT purchase_date FROM input)) LIMIT 1
),
rec AS (
  INSERT INTO public.receipts (user_id, store_id, purchase_date, receipt_number, total_amount, item_count, expense_id)
  SELECT i.uid, (SELECT id FROM store LIMIT 1), i.purchase_date, i.receipt_number, i.total,
         (SELECT count(*) FROM lines WHERE NOT is_deposit), (SELECT id FROM expense)
  FROM input i WHERE NOT EXISTS (SELECT 1 FROM dup)
  RETURNING id, user_id
)
INSERT INTO public.receipt_items (user_id, receipt_id, product_id, raw_name, article_number,
  quantity, unit_price, total_price, discount_amount, is_deposit)
SELECT rec.user_id, rec.id,
  coalesce(
    (SELECT a.product_id FROM public.product_aliases a WHERE a.user_id = rec.user_id AND a.article_number = l.article_number::text LIMIT 1),
    (SELECT ri.product_id FROM public.receipt_items ri WHERE ri.user_id = rec.user_id AND ri.article_number = l.article_number::text AND ri.product_id IS NOT NULL LIMIT 1),
    (SELECT a.product_id FROM public.product_aliases a WHERE a.user_id = rec.user_id AND lower(a.raw_name_pattern) = lower(l.raw_name) LIMIT 1),
    (SELECT p.id FROM public.products p WHERE p.user_id = rec.user_id AND lower(p.name) = lower(l.raw_name) LIMIT 1)),
  l.raw_name, l.article_number::text, l.quantity::numeric, l.unit_price::numeric,
  l.total_price::numeric, l.discount_amount::numeric, l.is_deposit
FROM rec CROSS JOIN lines l
RETURNING receipt_id, raw_name, product_id;
```

Tom retur = kvittot fanns redan. Rapportera till Tim: butik, datum, antal
varor, total, om det kopplades till ett köp och hur många varor som
kopplades till kända produkter.

## Varugrupper

Sätts i appen (Kvitton → vara → Varugrupp) och sparas i
`products.product_group`. Gissa inte och skriv inte dit grupper via SQL.
