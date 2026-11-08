'use client'

import { useRef } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { formatCurrency } from '@/lib/utils/formatters'
import { mockSpend } from './sandbox-data'

/**
 * Pointer-reactive credit card for the CCM view. Plain CSS 3D (perspective +
 * rotate) driven by springs, with a specular highlight that follows the
 * pointer. Same feel as a Three.js hero, without shipping a WebGL runtime.
 */
export function DepthCard() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const spring = { stiffness: 180, damping: 18, mass: 0.6 }
  const rotateY = useSpring(useTransform(px, [0, 1], [-14, 14]), spring)
  const rotateX = useSpring(useTransform(py, [0, 1], [10, -10]), spring)
  const glowX = useTransform(px, (v) => `${v * 100}%`)
  const glowY = useTransform(py, (v) => `${v * 100}%`)
  // Glare only while the pointer is on the card; at rest the surface stays matte
  const glareOpacity = useSpring(0, { stiffness: 200, damping: 30 })
  const glare = useMotionTemplate`radial-gradient(circle at ${glowX} ${glowY}, rgba(255,255,255,0.28), transparent 55%)`

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
    glareOpacity.set(1)
  }

  function reset() {
    px.set(0.5)
    py.set(0.5)
    glareOpacity.set(0)
  }

  const onCard = mockSpend.nextInvoice.registered
  const invoice = mockSpend.nextInvoice.value

  return (
    <div>
      <div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={reset}
        onPointerUp={reset}
        className="grid touch-pan-y place-items-center py-6 [perspective:900px]"
      >
        <motion.div
          style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
          className="relative aspect-[1.586] w-full max-w-[340px] select-none rounded-[22px] bg-[#2a2420] text-[#f4ede3] shadow-[0_30px_60px_-20px_rgba(42,36,32,0.55)]"
        >
          {/* Fine grain so the surface reads as material, not a flat fill */}
          <div
            className="absolute inset-0 rounded-[22px] opacity-[0.18] mix-blend-overlay"
            style={{
              backgroundImage:
                'repeating-linear-gradient(115deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 3px)',
            }}
            aria-hidden="true"
          />
          {!reduce && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-[22px]"
              style={{ background: glare, opacity: glareOpacity }}
              aria-hidden="true"
            />
          )}

          <div className="relative flex h-full flex-col justify-between p-5" style={{ transform: 'translateZ(30px)' }}>
            <div className="flex items-start justify-between">
              <span className="font-mono text-[11px] tracking-[0.2em] text-[#f4ede3]/60">KREDITKORT</span>
              <span className="h-7 w-10 rounded-md bg-gradient-to-br from-[#d4a574] to-[#9a6a3a]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] text-[#f4ede3]/60">Faktura 24 nov</p>
              <p className="mt-0.5 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                {formatCurrency(invoice)}
              </p>
              <div className="mt-3 flex justify-between font-mono text-[11px] tabular-nums text-[#f4ede3]/60">
                <span>•••• 1004</span>
                <span>{formatCurrency(onCard)} på kortet</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <p className="text-center text-[12px] text-muted-foreground">
        Dra fingret eller musen över kortet. Ingen lutning med reducerad rörelse.
      </p>
    </div>
  )
}
