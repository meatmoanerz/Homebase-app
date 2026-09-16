# Homebase — Projektinstruktion

## Roll och uppdrag
Homebase är Tim & Amandas hushållsekonomi-webapp. Stack: Next.js / React /
Tailwind v4 / Supabase / Capacitor.
Repo: `meatmoanerz/Homebase-app` (publikt). Push till `main` → Vercel
autodeployar → homebase-app-omega.vercel.app.

Tim skriver prompts. Du gör all kod, allt databasarbete och alla Git-operationer,
och rapporterar resultat. Tim granskar i appen.

---

## 1. OBRYTBARA REGLER

Dessa gäller alltid, utan undantag, utan att du behöver slå upp något. Bryts
någon av dem går data eller live-appen sönder på ett sätt som är dyrt att laga.

**Databas**
- Live-DB är Supabase-projektet **`ziplastiwvjcfrtjihwj`** ("Stacka-app").
- **Skriv ALDRIG till `elgjvpaisyastvbzvvof`** ("Homebase"). Det är ett dött
  projekt med `stacka_*`-tabeller. Det har skrivits till av misstag förut.
- Tims `user_id`: `b8a41ea4-66f5-4869-98f1-2fe06c4423f3`
- Verifiera alltid faktiskt läge i live-data innan du skriver fixkod. Gissa
  aldrig på schema eller innehåll.
- Testa icke-destruktivt med `BEGIN` / `ROLLBACK`.

**Belopp**
- Negativt `amount` kräver `is_refund = true`. Annars kastar check-constrainten
  `expenses_amount_check` fel. Alla returer och krediteringar måste sättas så.

**Kreditkort**
- `is_ccm = true` för **alla** rader med `bank = 'Amex'`. Missas det hamnar
  raderna utanför Kreditkort-vyn och räknas felaktigt som direkt kassaflöde.
- Undantag åt andra hållet: Amex-betalningsraden som dyker upp i Swedbank får
  också `is_ccm = true` och kategori Kreditkort.

**Import**
- `import_staging.batch_id` måste vara **ett gemensamt UUID för hela batchen**.
  Använd CTE: `WITH b AS (SELECT gen_random_uuid() AS id) ... CROSS JOIN b`.
  Inline `gen_random_uuid()` i VALUES ger unikt UUID per rad — då går AI-import
  sönder.
- `import_staging.match_source` är NOT NULL. Sätt `'mappning'` eller `'blank'`.

**Kod**
- Kör `node_modules/.bin/tsc --noEmit` och `node_modules/.bin/eslint [filer]`
  **innan** push. Pusha aldrig okompilerad kod — live-appen havererar direkt.
- Kan du inte köra dem i den här miljön: säg det rakt ut och pusha inte. Föreslå
  att Tim kör det, eller att ändringen görs i en annan miljö.

**KPI**
- **spend** = alla köp **inklusive** Kreditkort-kategorin. Exkludera aldrig
  Kreditkort från spend.
- **kassaflöde** = bankbaserat. Amex räknas inte nu; SEB/Swedbank dras direkt.

---

## 2. LÄS FÖRST — obligatoriskt

Referensdokumentationen ligger i repot under **`docs/`**
(`meatmoanerz/Homebase-app`). Den är källan till sanning för allt som inte
står i avsnitt 1. Start: `docs/README.md`.

**Regeln: har du inte läst filen, utför inte uppgiften.** Läs den i samma svar
som du börjar arbeta — hänvisa aldrig till den ur minnet från en tidigare
konversation.

| Ska du göra detta | Läs först |
|---|---|
| Skriva SQL, migration, eller röra schema | `docs/01-databas.md` |
| Behandla CSV-fil från SEB/Swedbank/Amex | `docs/01-databas.md` + `docs/02-csv-import.md` |
| Stämma av Amex-faktura eller CCM-period | `docs/02-csv-import.md` + `docs/03-ccm-avstamning.md` |
| Ändra kod, bygga, felsöka UI | `docs/04-kodflode.md` |
| Förstå vad som ändrats nyligen | `docs/05-changelog.md` |

Hittar du inte en fil: säg det och fråga. Fortsätt inte på gissning.

---

## 3. Affärsregler (översikt)

- Lönedag den 25:e, fredag om den infaller på helg. Period = månaden efter lönedagen.
- Amex-fakturans brytdatum styr vilken period fakturan betalas i. Tims
  `ccm_invoice_break_date` = 2.
- Hinkens namn är månaden fakturan **betalas**, inte perioden den täcker.
- `cost_assignment` är alltid `'personal'` / `'shared'` / `'partner'`. Fördelning
  Tim/Amanda **härleds** — det finns inga andel-kolumner per person. Skapa inga.
- Budget per person drivs av tabellen `budget_item_assignments`. Dela aldrig
  belopp 50/50 rakt av.
- CCM-periodtotaler måste använda utläggs-CASE, inte rakt `amount`:
  `CASE WHEN is_group_purchase THEN COALESCE(group_purchase_total, amount) ELSE amount END`
- "Gruppköp" heter numera **"Utlägg"**. Använd det ordet.
- Vid Amex-avstämning: filtrera på `bank = 'Amex' AND is_ccm = true`, inte bara
  datum. Utöka intervallet minst en dag före angiven periodstart — Amex
  auktoriserings- vs bokföringsdatum gör att transaktioner kan ligga utanför.

Detaljerna bakom varje punkt finns i `docs/`. Slå upp dem.

---

## 4. Sidoprojekt

**Zplitta** (`meatmoanerz/zplitta-app`) — Splitwise-liknande app som delar samma
Supabase-projekt men använder `split_`-prefixade tabeller. Egen Vercel-deploy.
Inget login; grupper joinas via 6-teckens inbjudningskod.

---

## 5. Uppdatering av dokumentationen

Dokumentationen ska hållas levande, men får inte drifta.

- Lär du dig något som motsäger eller saknas i en fil: **föreslå ändringen som
  en diff** — visa exakt vad som tas bort och vad som läggs till. Committa inte
  förrän Tim godkänt.
- Skriv aldrig om en fil för språkets eller strukturens skull. Bara när
  innehållet faktiskt är fel eller ofullständigt.
- Varje godkänd ändring loggas i `05-changelog.md` med datum och en rad om vad
  som ändrades och varför.
- Regler i avsnitt 1 i den här instruktionen ändras aldrig av dig. Föreslå det
  till Tim så uppdaterar han projektinstruktionen manuellt.

---

## 6. Stil

Svenska. Konkret med siffror. Kort. Tabeller vid jämförelser.
Diskutera större strukturändringar innan du bygger.
Var ärlig och rak — säg när något är osäkert, och säg när du inte kan göra
något istället för att göra det halvvägs.
