'use client'

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export interface TourStep {
  /** CSS selector of the element to highlight. Omit for a centred card. */
  target?: string
  title: string
  body: ReactNode
  /** Small illustration shown above the text (mock data, no real numbers). */
  visual?: ReactNode
}

interface GuidedTourProps {
  steps: TourStep[]
  onClose: (completed: boolean) => void
}

const PAD = 6
const CARD_GAP = 12

/** First element matching the selector that is actually on screen. */
function findVisible(selector: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(selector)
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden') return node
  }
  return null
}

/**
 * Step-by-step walkthrough that dims the page and cuts a spotlight around
 * the element each step talks about. Steps whose target is missing (other
 * layout, hidden feature) fall back to a centred card.
 */
export function GuidedTour({ steps, onClose }: GuidedTourProps) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const step = steps[index]
  const isLast = index === steps.length - 1

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight })
    if (!step?.target) {
      setRect(null)
      return
    }
    const el = findVisible(step.target)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step])

  // Bring the target into view, then measure once scrolling has settled.
  useLayoutEffect(() => {
    if (step?.target) {
      const el = findVisible(step.target)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    const frame = window.requestAnimationFrame(measure)
    const settle = window.setTimeout(measure, 350)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(settle)
    }
  }, [step, measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  const next = useCallback(() => {
    if (isLast) onClose(true)
    else setIndex((i) => i + 1)
  }, [isLast, onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose(false)
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, onClose])

  if (!step || typeof document === 'undefined') return null

  const cardWidth = Math.min(340, viewport.w - 32)
  let cardStyle: React.CSSProperties
  if (rect) {
    const spaceBelow = viewport.h - rect.bottom
    const placeBelow = spaceBelow > 240 || spaceBelow > rect.top
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardWidth / 2), viewport.w - cardWidth - 16)
    cardStyle = placeBelow
      ? { top: rect.bottom + PAD + CARD_GAP, left, width: cardWidth }
      : { bottom: viewport.h - rect.top + PAD + CARD_GAP, left, width: cardWidth }
  } else {
    cardStyle = { top: '50%', left: '50%', width: cardWidth, transform: 'translate(-50%, -50%)' }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200]"
      style={{ pointerEvents: 'auto' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {/* Click shield + dimming. With a target the spotlight's shadow dims instead. */}
      <div className={cn('absolute inset-0', !rect && 'bg-black/55')} onClick={(e) => e.stopPropagation()} />

      {rect && (
        <motion.div
          className="absolute rounded-2xl ring-2 ring-hb-cognac pointer-events-none"
          initial={false}
          animate={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)' }}
        />
      )}

      <div className="absolute" style={cardStyle}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="bg-card text-card-foreground rounded-2xl shadow-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 id="tour-title" className="font-serif text-[18px] font-medium tracking-tight leading-snug">
                {step.title}
              </h2>
              <button
                type="button"
                onClick={() => onClose(false)}
                className="p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground"
                aria-label="Stäng introduktionen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {step.visual && <div className="mt-3">{step.visual}</div>}
            <div className="mt-2 text-[14px] text-muted-foreground leading-relaxed space-y-2">{step.body}</div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex gap-1" aria-label={`Steg ${index + 1} av ${steps.length}`}>
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-4 bg-hb-cognac' : 'w-1.5 bg-muted-foreground/30')}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {index > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>
                    Tillbaka
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => onClose(false)}>
                    Hoppa över
                  </Button>
                )}
                <Button size="sm" onClick={next}>
                  {isLast ? 'Klar' : 'Nästa'}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      </div>
    </div>,
    document.body
  )
}
