'use client'

import type { TourStep } from '@/components/onboarding/guided-tour'
import type { OptionalModule } from '@/lib/onboarding/modules'

// Introductions shown the first time a page is opened. Visuals use made-up
// numbers so they never show (or leak) real data and never go stale with it.

export type TourKey = 'dashboard' | 'expenses' | 'budget' | 'import' | OptionalModule

export interface TourContext {
  hasPartner: boolean
  ccmEnabled: boolean
}

/** Which tour belongs to a path. Exact matches only, so sub-pages stay quiet. */
export const TOUR_PATHS: Record<string, TourKey> = {
  '/dashboard': 'dashboard',
  '/expenses': 'expenses',
  '/budget': 'budget',
  '/import': 'import',
  '/savings': 'savings',
  '/settings/loans': 'loans',
  '/settings/ccm': 'ccm',
  '/receipts': 'receipts',
  '/settings/shared-account': 'shared',
}

export function introKey(tour: TourKey): string {
  return `tour:${tour}`
}

function MockHero() {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3" aria-hidden="true">
      <div className="text-[11px] text-muted-foreground">Kvar att spendera</div>
      <div className="font-serif-kpi text-[24px] leading-tight">8 450 kr</div>
      <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full w-[62%] rounded-full bg-hb-cognac" />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>13 550 av 22 000 kr</span>
        <span>12 dagar till lön</span>
      </div>
    </div>
  )
}

function MockPeriod() {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3" aria-hidden="true">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium">25 okt</span>
        <span className="text-muted-foreground">en budgetperiod</span>
        <span className="font-medium">24 nov</span>
      </div>
      <div className="mt-2 relative h-2 rounded-full bg-secondary">
        <div className="absolute inset-y-0 left-0 w-[45%] rounded-full bg-hb-cognac/70" />
        <div className="absolute -top-1 left-0 w-1 h-4 rounded bg-hb-cognac" />
        <div className="absolute -top-1 right-0 w-1 h-4 rounded bg-hb-cognac" />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>Lön</span>
        <span>Nästa lön</span>
      </div>
    </div>
  )
}

function MockAssignment() {
  const rows = [
    { label: 'Personlig', note: 'Bara din', share: '100 %' },
    { label: 'Delad', note: 'Delas mellan er', share: '50/50' },
    { label: 'Partnerns', note: 'Du lade ut', share: '0 %' },
  ]
  return (
    <div className="rounded-xl border border-border divide-y divide-border text-[12px]" aria-hidden="true">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between px-3 py-1.5">
          <span>
            <span className="font-medium">{r.label}</span>
            <span className="text-muted-foreground"> · {r.note}</span>
          </span>
          <span className="text-muted-foreground">{r.share}</span>
        </div>
      ))}
    </div>
  )
}

function MockBudget() {
  const rows = [
    { name: 'Mat', spent: 3200, budget: 5000 },
    { name: 'Restaurang', spent: 1400, budget: 1200 },
    { name: 'Transport', spent: 600, budget: 1000 },
  ]
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2" aria-hidden="true">
      {rows.map((r) => {
        const pct = Math.min(100, (r.spent / r.budget) * 100)
        const over = r.spent > r.budget
        return (
          <div key={r.name}>
            <div className="flex justify-between text-[11px]">
              <span className="font-medium">{r.name}</span>
              <span className={over ? 'text-hb-terracotta' : 'text-muted-foreground'}>
                {r.spent.toLocaleString('sv-SE')} / {r.budget.toLocaleString('sv-SE')} kr
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className={over ? 'h-full bg-hb-terracotta' : 'h-full bg-hb-cognac'} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MockImport() {
  const rows = [
    { d: 'ICA NARA', c: 'Mat', a: '284 kr', ok: true },
    { d: 'SL APP', c: 'Kollektivtrafik', a: '42 kr', ok: true },
    { d: 'OKAND BUTIK', c: 'Välj kategori', a: '159 kr', ok: false },
  ]
  return (
    <div className="rounded-xl border border-border divide-y divide-border text-[12px]" aria-hidden="true">
      {rows.map((r) => (
        <div key={r.d} className="flex items-center justify-between px-3 py-1.5 gap-2">
          <span className="truncate">
            <span className="font-medium">{r.d}</span>
            <span className={r.ok ? 'text-muted-foreground' : 'text-hb-amber'}> · {r.c}</span>
          </span>
          <span className="text-muted-foreground shrink-0">{r.a}</span>
        </div>
      ))}
    </div>
  )
}

export function getTour(key: TourKey, ctx: TourContext): TourStep[] {
  switch (key) {
    case 'dashboard':
      return [
        {
          title: 'Välkommen till Homebase',
          visual: <MockHero />,
          body: <p>Översikten visar hur mycket du har kvar att spendera fram till nästa lön, och om du håller budgeten.</p>,
        },
        {
          title: 'Budgeten följer din lön',
          visual: <MockPeriod />,
          body: (
            <p>
              En period går från lönedag till lönedag, inte per kalendermånad. Då stämmer budgeten med när pengarna faktiskt
              kommer in.
            </p>
          ),
        },
        {
          target: '[data-tour="period"]',
          title: 'Bläddra mellan perioder',
          body: <p>Med pilarna ser du tidigare perioder, eller planerar nästa.</p>,
        },
        {
          target: '[data-tour="hero"]',
          title: 'Läget just nu',
          body: (
            <p>
              Här ser du vad du har spenderat, vad som är kvar och en prognos för perioden. Prognosen blir bättre efter ett par
              månaders historik.
            </p>
          ),
        },
        {
          target: 'nav a[href="/expenses"]',
          title: 'Lägg till en utgift',
          body: <p>Plusknappen tar dig rätt till ett nytt köp. Det tar några sekunder.</p>,
        },
        {
          target: 'nav a[href="/budget"]',
          title: 'Gör en budget',
          body: <p>Under Budget sätter du hur mycket du vill lägga på varje kategori under perioden.</p>,
        },
        {
          target: 'nav a[href="/settings"]',
          title: 'Mer finns här',
          body: (
            <p>
              Import från banken, partner, kategorier och tillval som sparmål, lån och kreditkort. Du slår på tillval under
              Mer › Funktioner.
            </p>
          ),
        },
      ]

    case 'expenses':
      return [
        {
          target: '[data-tour="expense-tabs"]',
          title: 'Registrera utgifter',
          body: (
            <p>
              Under <strong>Ny</strong> skriver du in ett köp. <strong>Senaste</strong> visar det du lagt in och där kan du
              ändra. <strong>Återkommande</strong> är sådant som dras varje månad, som hyra och abonnemang.
            </p>
          ),
        },
        ...(ctx.hasPartner
          ? [
              {
                title: 'Vems är utgiften?',
                visual: <MockAssignment />,
                body: <p>Välj om köpet är ditt, delat mellan er eller din partners. Det styr hur budgeten räknas för var och en.</p>,
              },
            ]
          : []),
        {
          title: 'Snabbare med import',
          body: (
            <p>
              Vill du slippa skriva in allt? Ladda ner en CSV-fil från banken och läs in den under Mer › Importera. Homebase
              föreslår kategorier och lär sig av dina val.
            </p>
          ),
        },
      ]

    case 'budget':
      return [
        {
          title: 'Så fungerar budgeten',
          visual: <MockBudget />,
          body: (
            <p>
              Du sätter ett belopp per kategori för perioden. När du lägger in utgifter ser du direkt hur mycket som är kvar i
              varje kategori.
            </p>
          ),
        },
        {
          target: 'main a[href="/budget/new"]',
          title: 'Skapa din första budget',
          body: (
            <p>
              Börja här. Nästa månad kan du kopiera förra budgeten och bara justera det som ändrats.
            </p>
          ),
        },
      ]

    case 'import':
      return [
        {
          title: 'Läs in transaktioner från banken',
          visual: <MockImport />,
          body: (
            <>
              <p>Ladda ner kontohändelser som CSV i din internetbank och välj filen här. SEB, Swedbank och Amex känns igen direkt.</p>
              <p>Du granskar alltid raderna innan något sparas. Kategorier du väljer kommer Homebase ihåg till nästa gång.</p>
            </>
          ),
        },
      ]

    case 'savings':
      return [
        {
          title: 'Sparmål',
          body: (
            <>
              <p>Skapa ett mål, till exempel buffert eller en resa, och ange hur mycket du vill spara.</p>
              <p>
                Varje mål får en egen sparkategori. När du för över pengar lägger du in det som en utgift i den kategorin, så
                räknas det mot målet och du ser hur nära du är.
              </p>
            </>
          ),
        },
      ]

    case 'loans':
      return [
        {
          title: 'Lån',
          body: (
            <>
              <p>Lägg in bolån, billån eller CSN med saldo, ränta och amortering.</p>
              <p>Homebase räknar ut månadskostnaden och kan lägga in ränta och amortering i budgeten åt dig.</p>
            </>
          ),
        },
      ]

    case 'ccm':
      return [
        {
          title: 'Kreditkort',
          body: (
            <>
              <p>
                Köp på kreditkort räknas som förbrukning när du handlar, men pengarna lämnar kontot först när fakturan betalas.
              </p>
              <p>
                Här lägger du in dina kort med brytdatum och förfallodag. Sedan ser du vad nästa faktura blir och kan stämma av
                den mot kortutdraget.
              </p>
              {!ctx.ccmEnabled && <p>Slå på Kreditkort under Mer › Funktioner för att börja.</p>}
            </>
          ),
        },
      ]

    case 'receipts':
      return [
        {
          title: 'Kvitton',
          body: (
            <>
              <p>Ladda upp matkvitton, till exempel från Kivra eller ICA-appen. Varje vara sparas för sig.</p>
              <p>Med tiden ser du vad du köper mest och hur priserna ändras mellan butiker.</p>
            </>
          ),
        },
      ]

    case 'shared':
      return [
        {
          title: 'Gemensam ekonomi',
          body: (
            <>
              <p>Här ser ni hur mycket var och en ska föra över till det gemensamma kontot den här perioden.</p>
              <p>Beräkningen följer hushållsmodellen ni valt, och ni bockar av överföringarna när de är gjorda.</p>
            </>
          ),
        },
      ]
  }
}
