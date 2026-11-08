'use client'

import { useLayoutEffect, useRef } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

interface AmountProps {
  value: number
  /** Text before the number, e.g. "~" or "+". */
  prefix?: string
  className?: string
}

const digitsOf = (value: number) => formatCurrency(value).replace(/\s?kr$/, '')
const amountClass = 'font-mono tabular-nums tracking-[-0.04em]'

function Unit() {
  return <span className="ml-[0.2em] font-sans text-[max(0.62em,11px)] font-normal tracking-normal opacity-60">kr</span>
}

/**
 * A money amount: digits in mono with tabular figures, "kr" small, muted and
 * in sans. In a monospace face the unit is as wide as a digit, so at full size
 * it competes with the number itself.
 */
export function Amount({ value, prefix = '', className }: AmountProps) {
  return (
    <span className={cn(amountClass, className)}>
      {prefix}
      {digitsOf(value)}
      <Unit />
    </span>
  )
}

interface AnimatedAmountProps extends AmountProps {
  /**
   * Count up from 0 the first time this key is shown in the session (the
   * reveal). Without it the first render shows the value straight away.
   */
  revealKey?: string
}

/**
 * Amount that moves when its value changes: from the old number to the new
 * one instead of swapping, so a new purchase or a switched range reads as a
 * change. Tabular figures keep the width steady while it counts. Respects
 * reduced motion.
 */
export function AnimatedAmount({ value, prefix = '', className, revealKey }: AnimatedAmountProps) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => digitsOf(Math.round(v)))
  const firstRun = useRef(true)

  // Layout effect, so the reveal starts from 0 before the first paint. The
  // session check runs here and not in render, which keeps SSR and hydration
  // identical.
  useLayoutEffect(() => {
    let isReveal = false
    if (firstRun.current) {
      firstRun.current = false
      if (revealKey && !reduce) {
        try {
          const key = `hb-reveal:${revealKey}`
          isReveal = sessionStorage.getItem(key) == null
          sessionStorage.setItem(key, '1')
        } catch {
          // Private mode: no reveal
        }
      }
    }
    if (reduce) {
      mv.set(value)
      return
    }
    if (isReveal) mv.set(0)
    const controls = animate(mv, value, { duration: isReveal ? 1.1 : 0.5, ease: [0.2, 0, 0, 1] })
    return () => controls.stop()
  }, [value, reduce, mv, revealKey])

  return (
    <span className={cn(amountClass, className)}>
      <span className="sr-only">{prefix}{formatCurrency(value)}</span>
      <span aria-hidden="true">
        {prefix}
        <motion.span>{text}</motion.span>
        <Unit />
      </span>
    </span>
  )
}
