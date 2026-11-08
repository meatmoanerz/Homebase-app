import { cn } from '@/lib/utils/cn'

export type FindingStatus = 'fail' | 'warn' | 'pass'

export interface Finding {
  title: string
  detail: string
  where?: string
  status: FindingStatus
}

/**
 * Vercel web-interface-guidelines run against the dashboard and layout code
 * (src/components/dashboard, src/components/layout, src/app/layout.tsx).
 */
export const guidelineFindings: Finding[] = [
  {
    status: 'fail',
    title: 'Inga tabellsiffror',
    detail:
      'tabular-nums används ingenstans. Belopp i listor hamnar inte under varandra och siffror hoppar i sidled när de ändras.',
    where: '0 träffar i src/',
  },
  {
    status: 'fail',
    title: 'transition: all på staplar och knappar',
    detail: 'Animerar fler egenskaper än det som rör sig. Lista width/transform istället.',
    where: 'spend-hero.tsx:86 · person-budget-breakdown.tsx:66 · ui/button.tsx:20',
  },
  {
    status: 'warn',
    title: 'Zoom är avstängd',
    detail:
      'maximumScale: 1 och userScalable: false stoppar nypzoom. Medvetet för app-känslan, men det stänger ute den som behöver större text.',
    where: 'app/layout.tsx · viewport',
  },
  {
    status: 'warn',
    title: '"..." istället för …',
    detail: 'Laddningstexter och avkortningar använder tre punkter.',
    where: 'recurring-expenses-widget.tsx:109 · loading-spinner.tsx:32 · sv.json',
  },
  {
    status: 'warn',
    title: 'Rubriker radbryts ojämnt',
    detail: 'Ingen text-balance på rubriker, så ensamma ord hamnar på sista raden.',
    where: '0 träffar i src/',
  },
  {
    status: 'pass',
    title: 'Reducerad rörelse respekteras',
    detail: 'MotionConfig reducedMotion="user" i providers.tsx och splash-animationen stängs av.',
    where: 'providers.tsx:67 · globals.css:419',
  },
  {
    status: 'pass',
    title: 'Synlig fokusmarkering',
    detail: 'Globalt :focus-visible-outline i cognac, och ui-komponenterna har egna ringar.',
    where: 'globals.css',
  },
]

/**
 * Layout critique, ranked by how much each fix changes how the app feels.
 * Counts come from grepping src/.
 */
export const critiqueFindings: Finding[] = [
  {
    status: 'fail',
    title: 'Allt ligger i ett kort',
    detail:
      '265 skuggor och 125 rounded-2xl/3xl. När varje block är en låda bär lådorna hierarkin istället för typografin, och allt väger lika. Spara kortet till en sak per vy, låt resten vara text, luft och hårlinjer.',
  },
  {
    status: 'fail',
    title: 'Siffran säger inte vad den betyder',
    detail:
      '"Kvar att spendera 7 580 kr" kräver huvudräkning. "≈ 689 kr om dagen i 11 dagar" går att agera på direkt.',
  },
  {
    status: 'warn',
    title: 'Dekorativ glöd i hörnet',
    detail:
      'Den radiella gradienten bakom heron (spend-hero.tsx:62) är ett av de tydligaste AI-mönstren. Den tillför ingen information.',
  },
  {
    status: 'warn',
    title: 'VERSALA ETIKETTER överallt',
    detail:
      'label-caps på 19 ställen. När varje etikett skriker blir ingen hörd. Välj en nivå med versaler, resten i vanlig skiftläge.',
  },
  {
    status: 'warn',
    title: 'Allt glider in vid sidladdning',
    detail:
      '18 initial={…} på dashboarden. Rörelse som sker varje gång betyder ingenting. Animera det som ändras: ett nytt köp, en siffra som flyttar sig.',
  },
]

const statusLabel: Record<FindingStatus, string> = {
  fail: 'Åtgärda',
  warn: 'Överväg',
  pass: 'OK',
}

const statusClass: Record<FindingStatus, string> = {
  fail: 'text-destructive',
  warn: 'text-hb-amber',
  pass: 'text-hb-green',
}

interface FindingsListProps {
  findings: Finding[]
  ranked?: boolean
}

export function FindingsList({ findings, ranked = false }: FindingsListProps) {
  const ListTag = ranked ? 'ol' : 'ul'
  return (
    <ListTag className="divide-y divide-border border-y border-border">
      {findings.map((f, i) => (
        <li key={f.title} className="grid grid-cols-[2.25rem_1fr] gap-x-3 py-3.5">
          <span className="pt-0.5 font-mono text-[12px] tabular-nums text-muted-foreground">
            {ranked ? String(i + 1).padStart(2, '0') : '—'}
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-medium leading-snug text-balance">{f.title}</h3>
              <span className={cn('shrink-0 font-mono text-[11px]', statusClass[f.status])}>
                {statusLabel[f.status]}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground text-pretty">
              {f.detail}
            </p>
            {f.where && (
              <p className="mt-1.5 break-words font-mono text-[11px] text-muted-foreground/80" translate="no">
                {f.where}
              </p>
            )}
          </div>
        </li>
      ))}
    </ListTag>
  )
}
