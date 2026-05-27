'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { motion } from 'framer-motion'
import { triggerHaptic } from '@/hooks/use-capacitor'

// Custom icons with filled/outlined variants
function HomeIcon({ filled, className }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.71 2.29a1 1 0 00-1.42 0l-9 9a1 1 0 001.42 1.42L4 12.41V21a1 1 0 001 1h5a1 1 0 001-1v-5h2v5a1 1 0 001 1h5a1 1 0 001-1v-8.59l.29.3a1 1 0 001.42-1.42l-9-9z"/>
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function WalletIcon({ filled, className }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 7H3V5a2 2 0 012-2h14a2 2 0 012 2v2zm0 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9h18zm-5 4a1 1 0 100 2 1 1 0 000-2z"/>
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20"/>
      <circle cx="16" cy="14" r="1"/>
    </svg>
  )
}

function ReceiptIcon({ filled, className }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-2 12H7v-2h10v2zm0-4H7V9h10v2z"/>
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M7 9h10"/>
      <path d="M7 13h10"/>
      <path d="M7 17h6"/>
    </svg>
  )
}

function MoreIcon({ filled, className }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="2.5"/>
        <circle cx="12" cy="12" r="2.5"/>
        <circle cx="19" cy="12" r="2.5"/>
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1"/>
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 8v8"/>
      <path d="M8 12h8"/>
    </svg>
  )
}

const navItems = [
  {
    href: '/dashboard',
    label: 'Hem',
    Icon: HomeIcon,
    matchPath: '/dashboard',
  },
  {
    href: '/budget',
    label: 'Budget',
    Icon: WalletIcon,
    matchPath: '/budget',
  },
  {
    href: '/expenses',
    label: '',
    Icon: PlusIcon,
    isMain: true,
  },
  {
    href: '/expenses/list',
    label: 'Utgifter',
    Icon: ReceiptIcon,
    matchPath: '/expenses/list',
  },
  {
    href: '/settings',
    label: 'Mer',
    Icon: MoreIcon,
    matchPath: '/settings',
  },
]

interface BottomNavProps {
  className?: string
}

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-card/95 backdrop-blur-lg border-t border-border keyboard-hide",
        // Use safe-area-inset for positioning to handle browser chrome changes
        "pb-[env(safe-area-inset-bottom,0px)]",
        className
      )}
      style={{
        // Ensure consistent positioning with browser chrome changes
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      aria-label="Mobilnavigation"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          // Check if this route is active
          const isActive = item.matchPath
            ? pathname === item.matchPath || pathname.startsWith(item.matchPath + '/')
            : false
          const { Icon } = item

          if (item.isMain) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center justify-center -mt-6"
                aria-label="Lägg till ny utgift"
                onClick={() => triggerHaptic('medium')}
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-hb-cognac to-[#5a7360] text-white shadow-lg shadow-hb-cognac/30"
                >
                  <Icon className="w-7 h-7" aria-hidden="true" />
                </motion.div>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-4 transition-colors relative min-w-[60px]",
                isActive ? "text-hb-cognac" : "text-muted-foreground"
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => triggerHaptic('light')}
            >
              <Icon filled={isActive} className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {/* Dot indicator */}
              {isActive && (
                <motion.div
                  layoutId="navDot"
                  className="absolute -bottom-1 w-1 h-1 rounded-full bg-hb-cognac"
                  transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
