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
    status: 'pass',
    title: 'Tabellsiffror i hela appen',
    detail:
      'Belopp går via <Amount> eller font-serif-kpi/hero, som nu är monospace med tabular-nums. Siffror hamnar under varandra och hoppar inte när de ändras.',
    where: 'components/shared/amount.tsx · globals.css',
  },
  {
    status: 'pass',
    title: 'Inga transition: all i staplar och knappar',
    detail: 'Staplarna animerar bara width och knappen listar opacity, transform och färger.',
    where: 'ui/button.tsx:20',
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
    status: 'pass',
    title: 'Allt låg i ett kort',
    detail:
      'Hela appen är platt: kort är en ton av bakgrunden utan kant och skugga, och varje vy har en mörk platta för sin huvudsiffra.',
  },
  {
    status: 'pass',
    title: 'Siffran säger vad den betyder',
    detail:
      'Heron visar nu “≈ 689 kr om dagen” under det som är kvar, och ett streck för idag på stapeln så takten syns direkt.',
  },
  {
    status: 'pass',
    title: 'Dekorativ glöd i hörnet',
    detail: 'Borttagen. Den radiella gradienten bakom heron var ett av de tydligaste AI-mönstren.',
  },
  {
    status: 'pass',
    title: 'VERSALA ETIKETTER överallt',
    detail: 'label-caps är nu vanlig skiftläge i 12 px. Klassen ligger kvar så alla 19 ställen följde med.',
  },
  {
    status: 'pass',
    title: 'Allt glider in vid sidladdning',
    detail:
      'Borttaget på översikten. Rörelse finns nu där något ändras: siffran räknar fram första gången per session och när den byts, heron krymper till ett piller när du scrollar förbi, och indikatorn glider i Analys.',
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
