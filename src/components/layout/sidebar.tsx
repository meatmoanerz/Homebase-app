'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { Home, Wallet, Receipt, Target, Settings, Plus, FileSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggleCompact } from '@/components/ui/theme-toggle'

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Hem' },
  { href: '/budget', icon: Wallet, label: 'Budget' },
  { href: '/expenses/list', icon: Receipt, label: 'Utgifter' },
  { href: '/statement-analyzer', icon: FileSearch, label: 'Importera' },
  { href: '/savings', icon: Target, label: 'Sparande' },
  { href: '/settings', icon: Settings, label: 'Inställningar' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card/80 backdrop-blur-sm z-40">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-hb-cognac to-hb-sage flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-xl font-bold text-hb-cognac">Homebase</span>
        </Link>
        <ThemeToggleCompact />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Huvudnavigation">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-hb-cognac text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-hb-sage/30 hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Quick Add Button */}
      <div className="p-4 border-t border-border">
        <Link href="/expenses" className="block">
          <Button className="w-full" size="lg">
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Ny utgift
          </Button>
        </Link>
      </div>
    </aside>
  )
}
