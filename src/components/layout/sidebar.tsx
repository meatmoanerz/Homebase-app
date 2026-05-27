'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { Home, Wallet, Receipt, ListChecks, Settings, Plus } from 'lucide-react'
import { useUser, usePartner } from '@/hooks/use-user'
import { usePerspective } from '@/hooks/use-perspective'

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Översikt' },
  { href: '/expenses/list', icon: ListChecks, label: 'Utgifter' },
  { href: '/budget', icon: Wallet, label: 'Budget' },
  { href: '/receipts', icon: Receipt, label: 'Kvitton' },
  { href: '/settings', icon: Settings, label: 'Inställningar' },
]

function PerspectiveAvatars() {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { perspective, setPerspective } = usePerspective()

  const userInitial = (user?.first_name?.[0] || 'J').toUpperCase()
  const partnerInitial = (partner?.first_name?.[0] || 'P').toUpperCase()

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold px-3 mb-2.5">
        Visar för
      </div>
      <div className="flex gap-1.5 px-2">
        <button
          onClick={() => setPerspective('all')}
          className={cn(
            "w-10 h-10 rounded-full border-2 grid place-items-center transition-all",
            perspective === 'all' ? "border-foreground" : "border-transparent"
          )}
          aria-label="Visa för alla"
          title="Alla"
        >
          <div className="w-8 h-8 rounded-full bg-secondary text-foreground grid place-items-center font-serif font-semibold text-sm">
            ●
          </div>
        </button>
        <button
          onClick={() => setPerspective('me')}
          className={cn(
            "w-10 h-10 rounded-full border-2 grid place-items-center transition-all",
            perspective === 'me' ? "border-hb-tim" : "border-transparent"
          )}
          aria-label={`Visa för ${user?.first_name || 'mig'}`}
          title={user?.first_name || 'Du'}
        >
          <div className="w-8 h-8 rounded-full bg-hb-tim-soft text-hb-tim grid place-items-center font-serif font-semibold text-sm">
            {userInitial}
          </div>
        </button>
        {partner && (
          <button
            onClick={() => setPerspective('partner')}
            className={cn(
              "w-10 h-10 rounded-full border-2 grid place-items-center transition-all",
              perspective === 'partner' ? "border-hb-amanda" : "border-transparent"
            )}
            aria-label={`Visa för ${partner.first_name}`}
            title={partner.first_name}
          >
            <div className="w-8 h-8 rounded-full bg-hb-amanda-soft text-hb-amanda grid place-items-center font-serif font-semibold text-sm">
              {partnerInitial}
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-secondary/60 backdrop-blur-sm z-40 p-4">
      {/* Logo */}
      <div className="px-3 pb-7">
        <Link href="/dashboard" className="font-serif font-medium text-[22px] tracking-tight text-foreground inline-flex items-baseline gap-1.5">
          homebase
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-hb-cognac -translate-y-0.5" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 flex-1" aria-label="Huvudnavigation">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all',
                isActive
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Perspective avatars at the bottom */}
      <PerspectiveAvatars />
    </aside>
  )
}
