'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  children: React.ReactNode
  /** Sticky area under the title (search field, tabs). */
  toolbar?: React.ReactNode
  /** Sticky footer (primary action). */
  footer?: React.ReactNode
  className?: string
}

const noopSubscribe = () => () => {}

/**
 * Mobile-first sheet that slides up from the bottom; a centred panel on
 * desktop. Sits below Dialog (z-150) so an edit dialog opened from inside
 * it appears on top.
 */
export function BottomSheet({ open, onOpenChange, title, subtitle, children, toolbar, footer, className }: BottomSheetProps) {
  // Portal to <body>: ancestors with backdrop-filter (header, sidebar)
  // would otherwise become the containing block for the fixed panel.
  // True on the client, false during SSR — without a setState-in-effect.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sheet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-foreground/30 backdrop-blur-[2px] z-[140]"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            key="sheet-panel"
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className={cn(
              'fixed z-[141] bg-card flex flex-col',
              'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
              'md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-6 md:w-full md:max-w-xl md:rounded-3xl md:max-h-[85dvh] md:border md:border-border md:shadow-2xl',
              className
            )}
          >
            <div className="px-5 pt-3 pb-3 border-b border-border/60">
              <div className="w-9 h-1 bg-border rounded-full mx-auto mb-3 md:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg font-medium tracking-tight truncate">{title}</h3>
                  {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 -mr-1 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary shrink-0"
                  aria-label="Stäng"
                >
                  <X className="w-[18px] h-[18px]" />
                </button>
              </div>
              {toolbar && <div className="mt-3">{toolbar}</div>}
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
            {footer && (
              <div
                className="px-5 pt-3 border-t border-border/60"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
              >
                {footer}
              </div>
            )}
            {!footer && <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
