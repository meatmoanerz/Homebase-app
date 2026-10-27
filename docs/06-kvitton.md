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

Ordning: **1** läs av kvittot → **2** hämta befintliga produkter → **3** spara
med mallen → **4** rapportera.

---

## Begrepp: produkt och artikel

- **Artikel** = butikens vara med eget artikelnummer ("Smör NS 82%",
  artikelnr 1396289). All data sparas per rad med artikelnummer och exakt
  kvittotext.
- **Produkt** (`products`) = det Tim köper, oavsett artikel ("Smör"). Flera
  artiklar kopplas till samma produkt. Appen visar snittpris per produkt och
  kan sedan visa varje artikel för sig. Den märker också när butiken byter
  artikel, t.ex. 85 % → 80 %.

Priser jämförs per kg, l eller st när förpackningsstorleken är känd. Därför är
storlek och vikt viktiga att få rätt.

---

## 1. Läsa av kvittot

En rad per köpt vara:

| Fält | Regel |
|---|---|
| `raw_name` | Varans namn, läsbart, stor bokstav först ("Kycklinglårfilé", inte "KYCKL.LÅRFILE"). Behåll siffror och storlek som står ("Smör NS 80%", "Kikärter 380G"). Hitta inte på. |
| `article_number` | Artikelnummer/EAN om det står, annars `NULL` |
| `quantity` | Antal förpackningar, **eller vikt i kg** för allt som säljs per kg (se nedan) |
| `unit_price` | Ordinarie pris per st eller per kg före rabatt |
| `total_price` | Vad raden kostade **efter** rabatt |
| `discount_amount` | Rabatter som hör till raden, **positivt** tal, annars `0` |
| `is_deposit` | `true` för pant |
| `package_size`, `package_unit` | Hur mycket **en** förpackning innehåller, se nedan |
| `product_name` | Befintlig produkt raden ska kopplas till (steg 2), annars `NULL` |

**Vikt och storlek:**

- **Säljs per kg** (lösvikt, och färdigpackat kött/ost/frukt med kilopris på
  kvittot): `quantity` = vikten i kg, `unit_price` = kilopriset,
  `package_size` = `1`, `package_unit` = `'kg'`. Står bara kilopris och
  radbelopp ("Wagyu Biff 1795,00/kg 240,50"): vikten = (radbelopp + rabatt) /
  kilopris = 0.134.
- **Styckvaror med känd storlek** på kvittot eller i namnet: storleken i
  `package_size` med enheten `kg`, `l` eller `st`:
  - "Kikärter 380G" → `0.38`, `'kg'`
  - "Gräddfil 3DL" → `0.3`, `'l'`
  - "Ägg 6-pack" → `6`, `'st'`
  - "Babysemper 6P/200ML" → `1.2`, `'l'`
- **Okänd storlek:** `NULL, NULL`. Mallen hämtar då storleken från tidigare
  rader med samma artikelnummer. Gissa aldrig. Storleksintervall som
  "Up&Go 9-14kg" (blöjor) är ingen förpackningsstorlek.

**Övrigt:**

- Rabatt-/Stammisrader under en vara räknas in i varans `discount_amount` och
  dras från `total_price`. Gör inga egna rabattrader.
- Ta inte med betalning, moms, delsumma, totalsumma, bonus eller kortrader.
- Summan av `total_price` ska stämma med kvittots total (±2 kr). Stämmer den
  inte: säg det till Tim innan du sparar.

---

## 2. Koppla till befintliga produkter

Hämta Tims produkter med deras kända kvittotexter:

```sql
SELECT p.name, string_agg(DISTINCT ri.raw_name, ' | ') AS kvittotexter
FROM public.products p LEFT JOIN public.receipt_items ri ON ri.product_id = p.id
WHERE p.user_id = 'b8a41ea4-66f5-4869-98f1-2fe06c4423f3'
GROUP BY p.name ORDER BY p.name;
```

För varje rad: är det **samma vara som en befintlig produkt** men en annan
artikel (annan fetthalt, märke, storlek eller ny etikett), sätt
`product_name` till produktens namn exakt. Exempel: "Smör NS 80%" →
`'Smör'`, "Bruna Ägg 10-p" → `'Ägg'`.

Var försiktig:

- Koppla bara när det är samma sak att handla. "Smörgåsrån" är inte Smör, och
  "Potatis & fisk 8m" (barnmat) är inte Potatis.
- Osäker → `NULL`. Mallen kopplar ändå automatiskt via artikelnummer och
  kända kvittotexter, och Tim kan koppla ihop i appen (Kvitton → vara →
  *Lägg till variant*).
- Skapa inga nya produkter via SQL.

---

## 3. Spara — en SQL-sats

Kör mot `ziplastiwvjcfrtjihwj`. Byt bara ut värdena i `input` och `lines`.
Satsen:

- återanvänder butiken (samma namn) eller skapar den,
- gör ingenting om kvittot redan finns (samma dag + total + butik),
- kopplar varor till produkter: `product_name` först, sedan artikelnummer,
  kvittotext och produktnamn,
- tar förpackningsstorlek från tidigare rader av samma artikel när den saknas,
- lär sig nya artikelnummer (alias) så nästa kvitto kopplas direkt,
- kopplar kvittot till kort-/bankköpet (belopp ±1 kr, datum ±2 dagar).

```sql
WITH input AS (
  SELECT 'b8a41ea4-66f5-4869-98f1-2fe06c4423f3'::uuid AS uid,
         'ICA Nära Högdalen'::text AS store_name, 'ICA'::text AS chain, 'Stockholm'::text AS location,
         DATE '2026-10-22' AS purchase_date, '53'::text AS receipt_number, 612.40::numeric AS total
),
lines AS (
  SELECT * FROM (VALUES
    -- raw_name, article_number, quantity, unit_price, total_price, discount_amount, is_deposit, package_size, package_unit, product_name
    ('Smör NS 80%', '1368265', 1, 58.00, 58.00, 0, false, NULL, NULL, 'Smör'),
    ('Kikärter 380G', '7310130', 2, 12.95, 22.00, 3.90, false, 0.38, 'kg', NULL),
    ('Manchego Reserva', NULL, 0.146, 510.00, 74.46, 0, false, 1, 'kg', NULL),
    ('Pant', NULL, 1, 2.00, 2.00, 0, true, NULL, NULL, NULL)
  ) v(raw_name, article_number, quantity, unit_price, total_price, discount_amount, is_deposit, package_size, package_unit, product_name)
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
),
items AS (
  INSERT INTO public.receipt_items (user_id, receipt_id, product_id, raw_name, article_number,
    quantity, unit_price, total_price, discount_amount, is_deposit, package_size, package_unit)
  SELECT rec.user_id, rec.id,
    CASE WHEN l.is_deposit THEN NULL ELSE coalesce(
      (SELECT p.id FROM public.products p WHERE p.user_id = rec.user_id AND lower(p.name) = lower(l.product_name::text) LIMIT 1),
      (SELECT a.product_id FROM public.product_aliases a WHERE a.user_id = rec.user_id AND a.article_number = l.article_number::text LIMIT 1),
      (SELECT ri.product_id FROM public.receipt_items ri WHERE ri.user_id = rec.user_id AND ri.article_number = l.article_number::text AND ri.product_id IS NOT NULL LIMIT 1),
      (SELECT a.product_id FROM public.product_aliases a WHERE a.user_id = rec.user_id AND lower(a.raw_name_pattern) = lower(l.raw_name) LIMIT 1),
      (SELECT p.id FROM public.products p WHERE p.user_id = rec.user_id AND lower(p.name) = lower(l.raw_name) LIMIT 1)) END,
    l.raw_name, l.article_number::text, l.quantity::numeric, l.unit_price::numeric,
    l.total_price::numeric, l.discount_amount::numeric, l.is_deposit,
    coalesce(l.package_size::numeric, k.package_size), coalesce(l.package_unit::text, k.package_unit)
  FROM rec CROSS JOIN lines l
  LEFT JOIN LATERAL (
    SELECT ri.package_size, ri.package_unit FROM public.receipt_items ri
    WHERE ri.user_id = rec.user_id AND ri.article_number = l.article_number::text AND ri.package_unit IS NOT NULL
    ORDER BY ri.id LIMIT 1
  ) k ON l.package_unit IS NULL
  RETURNING raw_name, article_number, product_id, package_size, package_unit
),
aliases AS (
  INSERT INTO public.product_aliases (user_id, product_id, raw_name_pattern, article_number)
  SELECT DISTINCT ON (i.article_number) (SELECT uid FROM input), i.product_id, i.raw_name, i.article_number
  FROM items i
  WHERE i.product_id IS NOT NULL AND i.article_number IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.product_aliases a WHERE a.user_id = (SELECT uid FROM input) AND a.article_number = i.article_number)
  RETURNING article_number
)
SELECT i.raw_name, p.name AS product, i.package_size, i.package_unit,
       (SELECT count(*) FROM aliases) AS new_aliases
FROM items i LEFT JOIN public.products p ON p.id = i.product_id;
```

## 4. Rapportera

Tom retur betyder att kvittot redan fanns. Annars rapporterar du till Tim:

- butik, datum, antal varor och total;
- om kvittot kopplades till ett köp;
- hur många varor som kopplades till kända produkter;
- **nya artiklar av befintliga produkter**, t.ex. "Smör: ny artikel Smör NS 80%
  (tidigare NS 82%)", eftersom det är så man märker när butiken bytt vara;
- vilka varor som saknar förpackningsstorlek.

## Varugrupper

Sätts i appen (Kvitton → vara → Varugrupp) och sparas i
`products.product_group`. Gissa inte och skriv inte dit grupper via SQL.
