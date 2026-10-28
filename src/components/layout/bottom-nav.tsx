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

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/>
      <path d="M8 16v-4"/><path d="M13 16V8"/><path d="M18 16v-6"/>
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

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.9"/>
      <circle cx="12" cy="12" r="1.9"/>
      <circle cx="19" cy="12" r="1.9"/>
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

const navItems = [
  { href: '/dashboard',    Icon: HomeIcon,     label: 'Översikt',  matchPath: '/dashboard' },
  { href: '/analys',       Icon: ChartIcon,    label: 'Analys',    matchPath: '/analys'    },
  { href: '/expenses',     Icon: PlusIcon,     label: 'Ny utgift', matchPath: null, isAdd: true },
  { href: '/budget',       Icon: WalletIcon,   label: 'Budget',    matchPath: '/budget'    },
  { href: '/settings',     Icon: MoreIcon,     label: 'Mer',       matchPath: '/settings'  },
]

interface BottomNavProps { className?: string }

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        "fixed z-[90] keyboard-hide",
        "bottom-[calc(env(safe-area-inset-bottom,0px)+20px)]",
        "left-1/2 -translate-x-1/2",
        "w-[calc(100%-40px)] max-w-[380px]",
        "bg-hb-nav rounded-full",
        "shadow-2xl shadow-hb-nav/25",
        "flex items-stretch",
        className
      )}
      aria-label="Mobilnavigation"
    >
      {navItems.map((item) => {
        const isActive = item.matchPath
          ? pathname === item.matchPath || pathname.startsWith(item.matchPath + '/')
          : false
        const { Icon } = item

        if (item.isAdd) {
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              aria-label="Lägg till ny utgift"
              onClick={() => triggerHaptic('medium')}
              className="flex-1 flex items-center justify-center py-3"
            >
              <motion.div
                whileTap={{ scale: 0.88 }}
                className="w-9 h-9 rounded-full bg-hb-cognac grid place-items-center"
              >
                <PlusIcon className="w-[18px] h-[18px] text-hb-nav" />
              </motion.div>
            </Link>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => triggerHaptic('light')}
            className={cn(
              "flex-1 flex items-center justify-center py-3.5 rounded-full transition-colors duration-150",
              isActive ? "text-hb-cognac" : "text-hb-nav-foreground/50"
            )}
          >
            <Icon className="w-[19px] h-[19px]" />
          </Link>
        )
      })}
    </nav>
  )
}
