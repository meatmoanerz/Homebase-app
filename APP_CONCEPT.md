# Stacka – App Concept Documentation

## Vad är Stacka?

Stacka är en **hushållsekonomisk app** för privatpersoner och par. Användaren spårar utgifter, hanterar budgetar, sätter sparmål och analyserar sin ekonomi. Det unika är att budgetperioder är **lönedagsbaserade** (inte kalendermånader) och att app:en har inbyggt stöd för **partnerdelning** – två personer kan koppla ihop sina konton och dela ekonomin.

---

## Kärnkoncept

### 1. Budgetperioder (Lönebaserade)

Budgetar löper **från lönedagen en månad till lönedagen nästa månad**, inte kalendervis.

- Varje användare anger sin `salary_day` (dag 1–31) i profilen
- Exempel: `salary_day = 25` → "Maj-budget" = 25 april → 24 maj
- Om lönedagen faller på lördag/söndag justeras den till föregående fredag
- All filtrering av utgifter och budgetar utgår från detta

**Viktiga funktioner i `src/lib/utils/budget-period.ts`:**
- `getBudgetPeriod(date, salaryDay)` – vilken period tillhör ett datum?
- `getPeriodDates(period, salaryDay)` – start- och slutdatum för en period
- `getPeriodProgress(salaryDay)` – hur långt in i perioden är vi (0–100%)?
- `getDaysUntilSalary(salaryDay)` – dagar kvar till nästa lön

---

### 2. Kostnadsfördelning (Cost Assignment)

Varje utgift har ett `cost_assignment`-fält som styr hur den räknas i budgeten:

| Typ | Vem betalar | Budgetpåverkan |
|---|---|---|
| `personal` | Användaren | 100% räknas mot användaren |
| `shared` | Dela lika | 50% räknas mot vardera person |
| `partner` | Partnern betalar | 0% påverkar användaren |

Detta används i dashboardberäkningar, rapporter och budgetjämförelser.

---

### 3. Partnerkoppling

Två användare kan koppla ihop sina konton:

1. Användare A genererar en **inbjudningskod** (giltig 1 timme)
2. Användare B anger koden → status sätts till `active`
3. Supabase RLS-policies ger båda tillgång till varandras data seamlessly
4. Dashboard och rapporter visar **hushållstotaler** + per-personuppdelning

Tabellen `partner_connections` håller status: `pending` → `active` → `revoked`

---

### 4. Kategorier

Kategorier tillhör användaren och har:
- `cost_type`: `Fixed` / `Variable` / `Savings`
- `subcategory`: `Home`, `Housing`, `Transport`, `Entertainment`, `Loans`, `Savings`, `Other`
- `is_shared_expense` – om kategorin är ett hushållskonto
- `linked_savings_goal_id` – kopplas automatiskt till ett sparmål

Defaultkategorier skapas vid onboarding via `/api/setup-user`.

---

### 5. Utgifter (Expenses)

Varje utgift har:
- `amount`, `description`, `date`, `category_id`
- `cost_assignment` (se ovan)
- `assigned_to` – vilken användare som äger utgiften
- `is_recurring` + `recurring_expense_id` – om den skapats av en återkommande regel
- `is_ccm` – om den ingår i kreditkortsflödet (se CCM)
- `temporary_budget_id` – koppling till ett projektbudget
- `original_currency` + `original_amount` – för utländsk valuta
- `is_group_purchase` – för delade inköp med Swish-uppdelning

Optimistiska uppdateringar används – UI uppdateras direkt innan servern bekräftar.

---

### 6. Budgetar (Monthly Budgets)

Månadsbudgetar (`budgets`-tabellen) innehåller:
- `period` (format `YYYY-MM`)
- `total_income`, `total_expenses`, `total_savings`, `net_balance`
- **Budget Items** – rader med fasta/rörliga/sparposters med belopp
- **Budget Item Assignments** – vilken person ett budgetobjekt tillhör (vid partnerkoppling)

Flöde: Användaren skapar en budget för en period → lägger till poster → app:en jämför budget vs faktiska utgifter.

---

### 7. Kreditkortshanterare (CCM – Credit Card Manager)

CCM hanterar kreditkortsutgifter separat från direktbetalningar.

**Flöde:**
1. Utgifter markeras `is_ccm = true`
2. Grupperas i **fakturaperioder** baserat på `ccm_invoice_break_date` i profilen
3. Användaren anger faktiskt fakturabelopp i `ccm_invoices`
4. `calculatePaymentSplit()` beräknar vem som är skyldig vad:
   - Personliga utgifter: betalar själv
   - Delade (50/50): vardera hälften
   - Partner-utgifter: partnern betalar
   - Odifferens: delas 50/50
5. Stöd för **gruppinköp** (ex. gemensamma middagar) med Swish-återbetalning

---

### 8. Sparmål (Savings Goals)

**Skapandeflöde:**
1. Användaren skapar ett sparmål → en kategori med samma namn skapas automatiskt
2. När utgifter läggs till den kategorin skapas `savings_goal_contributions` automatiskt
3. Bidrag delas baserat på `cost_assignment` (personal/shared/partner)

**Mål-egenskaper:**
- `target_amount`, `target_date`
- `starting_balance` – befintligt sparande vid start
- `monthly_savings_enabled` + `monthly_savings_amount` – månatligt spartarget
- `goal_category`: `emergency`, `vacation`, `home`, `car`, `education`, `retirement`, `other`
- `custom_goal_type_id` – egna måltyper med ikon/färg
- `status`: `active` → `completed` / `archived`

---

### 9. Lån (Loans)

Lån grupperas i `loan_groups` (ex. "Bolån", "Billån"):
- `current_balance`, `interest_rate`, `monthly_amortization`
- `is_shared` – visas för partner
- `last_amortization_date`
- Historik för räntejusteringar (`loan_interest_history`)

**Månadsavisering:**
`useCreateExpensesFromLoans()` skapar automatiskt två utgifter per lån:
- Ränta: `saldo × (ränta / 100 / 12)`
- Amortering: fast månadsbelopp

Lånesaldot uppdateras automatiskt vid amortering.
Inbyggd **amorteringsplan** för 120 månader.

---

### 10. Återkommande utgifter (Recurring Expenses)

- `day_of_month` – vilken dag i månaden körs utgiften
- `is_active` – kan aktiveras/inaktiveras
- Cron-job: `/api/cron/process-recurring-expenses` körs dagligen och skapar utgifter

---

### 11. Projektbudgetar (Temporary Budgets)

För specifika projekt (semester, renovering, event):
- Eget datumintervall (inte lönedagsbaserat)
- Egna kategorier med budgeterade belopp
- Stöd för **utländsk valuta** (lagras i SEK, konverteras vid visning)
- Utgifter länkas via `temporary_budget_id`
- Status: `active` → `completed` / `archived`

---

### 12. Månadsinkomster

Två nivåer av inkomster:
- `incomes` – statiska inkomstkällor (lön, bidrag) som gäller varje period
- `monthly_incomes` – specifika belopp per period (kan skilja sig månad för månad)

Dashboard prioriterar månadsbelopp → faller tillbaka på statisk inkomst.
Via API kan månadsbelopp registreras för **båda partners**.

---

### 13. Kontoutdragsanalys (Statement Analyzer)

- Användaren laddar upp en PDF-bankutskrift
- OpenAI analyserar och extraherar transaktioner
- Användaren granskar och kategoriserar
- Massimport till `expenses`-tabellen
- Dubblettdetektering via `duplicate-matcher.ts`

---

## Sidor & Navigation

| Sida | Innehåll |
|---|---|
| `/dashboard` | KPI-kort, budgetöversikt, senaste utgifter, per-person-fördelning |
| `/expenses` | Lägg till utgift, utgiftslista, återkommande utgifter |
| `/budget` | Månadsbudgetar, projektbudgetar, inkomstöversikt |
| `/budget/[id]` | Budgetdetalj med budget vs faktisk |
| `/budget/archive` | Arkiverade budgetar |
| `/savings` | Sparmål – aktiva, avklarade, skapa nytt |
| `/savings/[id]` | Måldetalj med bidragshistorik |
| `/report` | Månadsrapport – trender, kategorier, budget vs faktisk, partneruppdelning |
| `/settings` | Profil, kategorier, lån, CCM, partner, hushållsinställningar |
| `/statement-analyzer` | PDF-import av kontoutdrag |

---

## Datamodeller (Sammanfattning)

### `profiles`
```
id, email, first_name, last_name, avatar_url
salary_day                      -- Lönedagen (1–31)
onboarding_completed, currency, language, theme
ccm_enabled, ccm_invoice_break_date
```

### `expenses`
```
id, user_id, category_id, amount, description, date
cost_assignment                 -- 'personal' | 'shared' | 'partner'
assigned_to                     -- user_id om tilldelad partner
is_recurring, recurring_expense_id
is_ccm                          -- ingår i kreditkortsflöde
is_group_purchase, group_purchase_total, group_purchase_user_share, group_purchase_partner_share
temporary_budget_id, temporary_budget_category_id
original_currency, original_amount
```

### `budgets`
```
id, user_id, partner_id, period  -- format: 'YYYY-MM'
total_income, total_expenses, total_ccm_expenses, total_savings
net_balance, savings_ratio, is_archived, version
```

### `categories`
```
id, user_id, name
cost_type                        -- 'Fixed' | 'Variable' | 'Savings'
subcategory                      -- 'Home' | 'Housing' | 'Transport' | 'Entertainment' | 'Loans' | 'Savings' | 'Other'
default_value, is_default, is_shared_expense
linked_savings_goal_id
```

### `savings_goals`
```
id, user_id, category_id, name, description
target_amount, target_date
starting_balance, starting_balance_user1, starting_balance_user2
monthly_savings_enabled, monthly_savings_amount
goal_category                    -- 'emergency' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'other'
custom_goal_type_id
is_shared, status                -- 'active' | 'completed' | 'archived'
```

### `loans`
```
id, user_id, group_id, name
original_amount, current_balance, interest_rate, monthly_amortization
last_amortization_date, is_shared
```

### `partner_connections`
```
id, user1_id, user2_id
status                           -- 'pending' | 'active' | 'rejected' | 'revoked'
initiated_by, invite_code, expires_at
```

### `recurring_expenses`
```
id, user_id, category_id, description, amount
day_of_month, cost_assignment, assigned_to
is_ccm, is_active
```

### `temporary_budgets`
```
id, user_id, name, description
start_date, end_date
status                           -- 'active' | 'completed' | 'archived'
total_budget, total_spent, currency, exchange_rate
```

### `ccm_invoices`
```
id, user_id, period, actual_amount, notes
```

### `monthly_incomes`
```
id, user_id, period, amount
```

---

## Teknisk Arkitektur

```
Frontend:        Next.js 16 (App Router) + React 19 + TypeScript strict
Styling:         Tailwind CSS v4 + shadcn/ui
Server state:    TanStack Query v5
UI state:        Zustand (filter-store, ui-store)
Backend:         Supabase (PostgreSQL + Auth + Realtime + RLS)
i18n:            next-intl (svenska + engelska)
Animationer:     framer-motion
Pakethanterare:  pnpm
Deploy:          Vercel
```

### Dataflöde

```
Komponent
  → TanStack Query hook (src/hooks/use-*.ts)
    → Supabase klient (browser eller server)
      → PostgreSQL med RLS (filtrerar automatiskt per user/partner)
        → Realtime WebSocket (synkar ändringar live)
```

### Supabase-klienter

- `src/lib/supabase/client.ts` – Browser (Client Components)
- `src/lib/supabase/server.ts` – Server (Server Components / API routes)

### Query Key-mönster

```typescript
['user']                        // Inloggad användare
['partner']                     // Partnerprofil
['expenses', options]           // Utgifter med filter
['expenses', 'period', period]  // Periodspecifika
['expenses', 'ccm', breakDate]  // Kreditkortsutgifter
['budgets']                     // Alla budgetar
['budget', id]                  // Specifik budget
['categories']                  // Kategorier
['dashboard']                   // Dashboarddata
['savings-goals']               // Sparmål
['loans']                       // Lån
['monthly-incomes', period]     // Periodinkomster
['recurring-expenses']          // Återkommande utgifter
['ccm-invoices']                // Kreditkortsfakturor
```

### Mutationsmönster

```typescript
return useMutation({
  mutationFn: async (data) => { /* Supabase insert/update/delete */ },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    toast.success('...')
  },
  onError: () => {
    toast.error('...')
  },
})
```

---

## API Routes

| Route | Syfte |
|---|---|
| `/api/auth/callback` | OAuth-callback |
| `/api/setup-user` | Skapa defaultkategorier vid onboarding |
| `/api/partner` | Hämta partnerprofil och kopplingsstatus |
| `/api/partner-loans` | Hämta partnerns delade lån |
| `/api/monthly-incomes` | CRUD månadsinkomster (stöder partner) |
| `/api/household-incomes` | Kombinerade hushållsinkomster |
| `/api/statement/analyze` | OpenAI PDF-analys av kontoutdrag |
| `/api/cron/process-recurring-expenses` | Daglig körning av återkommande utgifter |
| `/api/admin/*` | Adminpanel (stats, CRUD alla tabeller) |

---

## Komponentstruktur

Komponenter följer feature-based naming:
```
src/components/{feature}/{feature}-{type}.tsx
```

Typer: `*-form.tsx`, `*-list.tsx`, `*-card.tsx`, `*-dialog.tsx`, `*-skeleton.tsx`

### Namnkonventioner
- Named exports (inga default exports för komponenter)
- `'use client'` endast när nödvändigt (hooks, events, browser APIs)
- `cn()` från `@/lib/utils/cn` för villkorliga Tailwind-klasser

---

## Färgkodning (UI)

| Token | Användning |
|---|---|
| `stacka-olive` | Primär varumärkesfärg |
| `stacka-sage` | Sekundär |
| `stacka-mint` | Accent |
| `stacka-peach` | Varm ton |
| `stacka-coral` | CCM / varning |
| `stacka-blue` | Delade utgifter |

---

## Viktiga Affärsregler

1. **Lönedagsperioder** – Använd alltid `budget-period.ts`-utilities, aldrig hårdkodade datum
2. **Kostnadsfördelning** – `personal` = 100%, `shared` = 50%, `partner` = 0% mot användarens budget
3. **Sparmålskategorier** – Skapas och arkiveras automatiskt med sparmålet
4. **Partner RLS** – All dataåtkomst filtreras automatiskt av Supabase, ingen manuell filtrering
5. **CCM är separat cashflow** – Kreditkortsutgifter räknas inte i direktkassaflöde
6. **Optimistiska uppdateringar** – Utgifter uppdateras i UI innan serverbekräftelse
7. **Alla strängar via i18n** – `useTranslations()` med `sv.json` och `en.json`
8. **RLS på alla tabeller** – Nya tabeller måste ha RLS-policies
