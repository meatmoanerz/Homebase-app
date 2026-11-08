'use client'

import { Suspense, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SandboxSection } from '@/components/sandbox/sandbox-section'
import { FindingsList, critiqueFindings, guidelineFindings } from '@/components/sandbox/findings-list'
import { HeroDirections, isDirectionId, type DirectionId } from '@/components/sandbox/hero-directions'
import { MotionLab } from '@/components/sandbox/motion-lab'
import { DepthCard } from '@/components/sandbox/depth-card'
import { TokenPlayground } from '@/components/sandbox/token-playground'

const toc = [
  { id: 'kvalitet', number: '01', label: 'Kvalitet' },
  { id: 'smak', number: '02', label: 'Smak' },
  { id: 'rorelse', number: '03', label: 'Rörelse' },
  { id: 'djup', number: '04', label: 'Djup' },
  { id: 'kritik', number: '05', label: 'Kritik' },
  { id: 'system', number: '06', label: 'System' },
]

/** Layout direction lives in the URL (?riktning=…) so a variant can be shared. */
function DirectionsFromUrl() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = params.get('riktning')
  const value: DirectionId = isDirectionId(raw) ? raw : 'nuvarande'

  const onChange = useCallback(
    (id: DirectionId) => {
      const next = new URLSearchParams(params.toString())
      next.set('riktning', id)
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [params, pathname, router]
  )

  return <HeroDirections value={value} onChange={onChange} />
}

export default function SandboxPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-4 md:px-8 md:pt-8">
      <header>
        <p className="font-mono text-[11px] text-muted-foreground">Homebase · designanteckningar</p>
        <h1 className="mt-2 font-serif text-[48px] leading-[0.95] text-balance md:text-[64px]">
          Designlabb
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-muted-foreground text-pretty">
          Sex idéer för att Homebase ska kännas mindre som en typisk AI-byggd app. Allt här bygger på påhittade
          siffror och sparar ingenting. Välj en riktning i 02, skruva på tokens i 06, och ta med det som känns rätt
          in i riktiga vyer.
        </p>
      </header>

      <nav
        aria-label="Avsnitt"
        className="sticky top-[calc(env(safe-area-inset-top,0px)+62px)] z-30 -mx-4 mt-6 border-y border-border bg-background/90 px-4 backdrop-blur md:top-0 md:-mx-8 md:px-8"
      >
        <ol className="no-scrollbar flex gap-5 overflow-x-auto py-2.5">
          {toc.map((t) => (
            <li key={t.id} className="shrink-0">
              <a
                href={`#${t.id}`}
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="mr-1 font-mono text-[10px] tabular-nums">{t.number}</span>
                {t.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-16">
        <SandboxSection
          id="kvalitet"
          number="01"
          kicker="Grunden"
          title="En kvalitetsribba först"
          lede="Vercels web-design-guidelines körda mot dashboarden och layouten. Det mesta är småsaker, men tillsammans är det skillnaden mellan “ser okej ut” och “känns gjord med omsorg”."
          prompt="Review this page against web-design-guidelines."
          source="github.com/vercel-labs/agent-skills"
        >
          <FindingsList findings={guidelineFindings} />
        </SandboxSection>

        <SandboxSection
          id="smak"
          number="02"
          kicker="Smakuppgraderingen"
          title="Mindre brus, samma siffror"
          lede="Fyra riktningar för översiktens överdel, alla med exakt samma data. Byt mellan dem och jämför med hur det ser ut idag. Valet sparas i adressen, så du kan skicka länken till Amanda."
          prompt="Audit this UI for generic patterns. Then polish the essentials."
          source="impeccable.style"
        >
          <Suspense fallback={<div className="h-[600px]" />}>
            <DirectionsFromUrl />
          </Suspense>
        </SandboxSection>

        <SandboxSection
          id="rorelse"
          number="03"
          kicker="Rörelselagret"
          title="Rörelse som betyder något"
          lede="Tre mönster: reveal, scroll och transition. Byggt med framer-motion som redan finns i appen, så GSAP behöver inte läggas till. Principen är densamma: animera det som ändras, inte allt som syns."
          prompt="Create a subtle hero reveal. Use a timeline."
          source="github.com/greensock/gsap-skills"
        >
          <MotionLab />
        </SandboxSection>

        <SandboxSection
          id="djup"
          number="04"
          kicker="Djupet"
          title="En dimension till, där den gör nytta"
          lede="Kreditkortsvyn är det enda stället där ett fysiskt föremål finns att avbilda. Kortet lutar efter fingret och ljuset följer med. Gjort i CSS 3D istället för Three.js, som hade lagt till runt 150 kB för en enda effekt."
          prompt="Build a lightweight 3D hero with pointer interaction."
          source="threejs.org"
        >
          <DepthCard />
        </SandboxSection>

        <SandboxSection
          id="kritik"
          number="05"
          kicker="Designkritik"
          title="Det som gör appen generisk, i ordning"
          lede="Rangordnat efter hur mycket varje ändring påverkar känslan. Siffrorna kommer från en sökning i koden, inte från en gissning."
          prompt="Critique this layout and rank the most useful improvements."
          source="figma.com/community/ai-skills"
        >
          <FindingsList findings={critiqueFindings} ranked />
        </SandboxSection>

        <SandboxSection
          id="system"
          number="06"
          kicker="Komponentsystemet"
          title="Börja här. Gör det till ert."
          lede="shadcn/ui är grunden redan, men med standardvärdena ser det ut som alla andra appar. Skruva på hörn, accent, siffror, ytor och täthet och se samma komponenter ändra karaktär."
          prompt="Make the defaults yours: radius, accent, numerals, surfaces."
          source="ui.shadcn.com"
        >
          <TokenPlayground />
        </SandboxSection>
      </div>
    </div>
  )
}
