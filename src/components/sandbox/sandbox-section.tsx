import { cn } from '@/lib/utils/cn'

interface SandboxSectionProps {
  id: string
  number: string
  kicker: string
  title: string
  lede: string
  /** The prompt from the reference slide, shown as a pull quote. */
  prompt?: string
  source?: string
  className?: string
  children: React.ReactNode
}

/**
 * One "fieldnote" in the design sandbox: numbered kicker, a large title that
 * carries the hierarchy, and a hairline instead of a card around it.
 */
export function SandboxSection({
  id,
  number,
  kicker,
  title,
  lede,
  prompt,
  source,
  className,
  children,
}: SandboxSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('scroll-mt-28 border-t border-foreground/15 pt-6', className)}
    >
      <p className="font-mono text-[11px] tracking-wide text-hb-cognac-deep dark:text-hb-cognac">
        <span className="tabular-nums">{number}</span> — {kicker}
      </p>
      <h2
        id={`${id}-title`}
        className="mt-2 font-serif text-[34px] leading-[1.02] text-balance md:text-[44px]"
      >
        {title}
      </h2>
      <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-muted-foreground text-pretty">
        {lede}
      </p>

      <div className="mt-6">{children}</div>

      {(prompt || source) && (
        <footer className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
          {prompt && (
            <p className="text-[13px] text-pretty">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Prompt
              </span>
              “{prompt}”
            </p>
          )}
          {source && (
            <span className="font-mono text-[11px] text-muted-foreground" translate="no">
              {source}
            </span>
          )}
        </footer>
      )}
    </section>
  )
}
