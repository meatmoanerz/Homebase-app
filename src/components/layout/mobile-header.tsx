'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser, usePartner } from '@/hooks/use-user'
import { usePerspective, type Perspective } from '@/hooks/use-perspective'
import { Check } from 'lucide-react'

const TITLES: Record<string, string> = {
  '/dashboard': 'Översikt',
  '/expenses': 'Ny utgift',
  '/expenses/list': 'Utgifter',
  '/budget': 'Budget',
  '/receipts': 'Kvitton',
  '/savings': 'Sparmål',
  '/settings': 'Inställningar',
  '/settings/profile': 'Profil',
  '/settings/categories': 'Kategorier',
  '/settings/loans': 'Lån',
  '/settings/ccm': 'Kreditkort',
  '/settings/partner': 'Partner',
  '/settings/shared-account': 'Gemensamt konto',
  '/settings/household-categories': 'Hushållskostnader',
  '/report': 'Månadsrapport',
  '/help': 'Hjälp',
  '/privacy': 'Integritet',
}

function pageTitle(pathname: string): string {
  // Exact match first
  if (TITLES[pathname]) return TITLES[pathname]
  // Find longest matching prefix
  const matches = Object.keys(TITLES)
    .filter((key) => pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)
  return matches[0] ? TITLES[matches[0]] : 'Homebase'
}

export function MobileHeader() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { perspective, setPerspective } = usePerspective()

  const userInitial = (user?.first_name?.[0] || 'J').toUpperCase()
  const partnerInitial = (partner?.first_name?.[0] || 'P').toUpperCase()

  const currentLabel =
    perspective === 'all'
      ? 'Alla'
      : perspective === 'me'
        ? user?.first_name || 'Du'
        : partner?.first_name || 'Partner'

  const currentInitial =
    perspective === 'all' ? '●' : perspective === 'me' ? userInitial : partnerInitial

  const triggerBgClass =
    perspective === 'me'
      ? 'bg-hb-tim-soft text-hb-tim'
      : perspective === 'partner'
        ? 'bg-hb-amanda-soft text-hb-amanda'
        : 'bg-secondary text-foreground'

  function handlePick(p: Perspective) {
    setPerspective(p)
    setTimeout(() => setSheetOpen(false), 120)
  }

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 px-5 py-3.5 glass border-b border-border/60">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-[22px] font-medium tracking-tight text-foreground">
            {pageTitle(pathname)}
          </h1>
          <button
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1.5 bg-card border border-border rounded-full pl-3 pr-1 py-1 text-xs font-medium text-muted-foreground active:scale-95 transition-transform"
            aria-label="Byt perspektiv"
          >
            <span>{currentLabel}</span>
            <div
              className={cn(
                'w-6 h-6 rounded-full grid place-items-center font-serif text-[11px] font-semibold',
                triggerBgClass
              )}
            >
              {currentInitial}
            </div>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-foreground/30 backdrop-blur-[2px] z-[200]"
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[201] bg-card rounded-t-3xl px-5 pt-3 pb-8"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
            >
              <div className="w-9 h-1 bg-border rounded-full mx-auto mb-4" />
              <h3 className="font-serif text-lg font-medium mb-4">Visar för</h3>
              <div className="flex flex-col gap-1">
                <SheetOption
                  active={perspective === 'all'}
                  onClick={() => handlePick('all')}
                  initial="●"
                  label="Alla"
                  variant="all"
                />
                <SheetOption
                  active={perspective === 'me'}
                  onClick={() => handlePick('me')}
                  initial={userInitial}
                  label={user?.first_name || 'Du'}
                  variant="me"
                />
                {partner && (
                  <SheetOption
                    active={perspective === 'partner'}
                    onClick={() => handlePick('partner')}
                    initial={partnerInitial}
                    label={partner.first_name}
                    variant="partner"
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function SheetOption({
  active,
  onClick,
  initial,
  label,
  variant,
}: {
  active: boolean
  onClick: () => void
  initial: string
  label: string
  variant: 'all' | 'me' | 'partner'
}) {
  const avClass =
    variant === 'me'
      ? 'bg-hb-tim-soft text-hb-tim'
      : variant === 'partner'
        ? 'bg-hb-amanda-soft text-hb-amanda'
        : 'bg-secondary text-foreground'

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3.5 py-3 px-1 rounded-[10px] text-[15px] active:bg-secondary text-left w-full transition-colors"
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full grid place-items-center font-serif text-[13px] font-semibold',
          avClass
        )}
      >
        {initial}
      </div>
      <span className={cn(active && 'font-semibold')}>{label}</span>
      {active && <Check className="ml-auto w-[18px] h-[18px] text-hb-cognac" />}
    </button>
  )
}
