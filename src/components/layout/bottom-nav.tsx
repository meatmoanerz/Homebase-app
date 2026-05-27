'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { motion } from 'framer-motion'
import { triggerHaptic } from '@/hooks/use-capacitor'

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20"/>
      <circle cx="16" cy="14" r="1"/>
    </svg>
  )
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2z"/>
      <path d="M8 7h8M8 11h8M8 15h5"/>
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 5H3v14h18z"/>
      <path d="M3 10h18"/>
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

const navItems = [
  { href: '/dashboard', label: 'Översikt', Icon: HomeIcon, matchPath: '/dashboard' },
  { href: '/expenses/list', label: 'Utgifter', Icon: ListIcon, matchPath: '/expenses' },
  { href: '/budget', label: 'Budget', Icon: WalletIcon, matchPath: '/budget' },
  { href: '/receipts', label: 'Kvitton', Icon: ReceiptIcon, matchPath: '/receipts' },
  { href: '/settings', label: 'Mer', Icon: SettingsIcon, matchPath: '/settings' },
]

interface BottomNavProps {
  className?: string
}

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Floating FAB - separate from nav, positioned above nav pill */}
      <Link
        href="/expenses"
        className={cn(
          "fixed right-5 z-[91] keyboard-hide md:hidden",
          "bottom-[calc(env(safe-area-inset-bottom,0px)+96px)]",
        )}
        aria-label="Lägg till ny utgift"
        onClick={() => triggerHaptic('medium')}
      >
        <motion.div
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center rounded-full bg-foreground text-background shadow-xl shadow-foreground/30"
          style={{ width: 52, height: 52 }}
        >
          <PlusIcon className="w-[22px] h-[22px]" />
        </motion.div>
      </Link>

      {/* Floating pill nav */}
      <nav
        className={cn(
          "fixed z-[90] keyboard-hide",
          "bottom-[calc(env(safe-area-inset-bottom,0px)+20px)]",
          "left-1/2 -translate-x-1/2",
          "w-[calc(100%-40px)] max-w-[380px]",
          "bg-foreground rounded-full p-1.5",
          "shadow-2xl shadow-foreground/20",
          "flex justify-around items-center",
          className
        )}
        aria-label="Mobilnavigation"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.matchPath || pathname.startsWith(item.matchPath + '/')
          const { Icon } = item

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center rounded-full transition-all duration-200",
                "min-w-[44px] min-h-[36px] px-3 py-2",
                isActive
                  ? "bg-hb-cognac text-foreground"
                  : "text-background/55"
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => triggerHaptic('light')}
            >
              <Icon className="w-[18px] h-[18px]" />
            </Link>
          )
        })}
      </nav>
    </>
  )
}
