'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { getInitials } from '@/lib/utils/formatters'
import { motion } from 'framer-motion'
import {
  User,
  FolderOpen,
  Landmark,
  CreditCard,
  Users,
  Target,
  LogOut,
  ChevronRight,
  HelpCircle,
  Shield,
  Palette,
  FileSearch,
  Wallet,
  Home,
  Sparkles,
  Receipt
} from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const menuItems = [
  {
    title: 'Konto',
    items: [
      { href: '/settings/profile', label: 'Profil', icon: User, description: 'Namn, löndag, inkomster' },
      { href: '/settings/categories', label: 'Kategorier', icon: FolderOpen, description: 'Hantera kostnadskategorier' },
    ]
  },
  {
    title: 'Ekonomi',
    items: [
      { href: '/import', label: 'Importera CSV', icon: FileSearch, description: 'Ladda upp transaktioner från CSV' },
      { href: '/settings/mappings', label: 'Kategoriregler', icon: Sparkles, description: 'Auto-kategorisering vid import' },
      { href: '/receipts', label: 'Kvitton', icon: Receipt, description: 'Inköp och prisanalys' },
      { href: '/settings/loans', label: 'Lån', icon: Landmark, description: 'Lån och skulder' },
      { href: '/settings/ccm', label: 'Kreditkortshanterare', icon: CreditCard, description: 'CCM-inställningar' },
      { href: '/savings', label: 'Sparmål', icon: Target, description: 'Dina besparingsmål' },
      { href: '/settings/shared-account', label: 'Gemensamt konto', icon: Wallet, description: 'Beräkna överföring' },
      { href: '/settings/household-categories', label: 'Hushållskostnader', icon: Home, description: 'Kategorier för hushållskostnader' },
    ]
  },
  {
    title: 'Delning',
    items: [
      { href: '/settings/partner', label: 'Partner', icon: Users, description: 'Koppla ihop konton' },
    ]
  },
]

export default function SettingsPage() {
  const { data: user, isLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Kunde inte logga ut')
    } else {
      router.push('/login')
      router.refresh()
    }
  }

  if (isLoading) {
    return <LoadingPage />
  }

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user?.avatar_url || undefined} />
                <AvatarFallback className="text-lg bg-hb-sage text-hb-cognac">
                  {getInitials(user?.first_name || '', user?.last_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-bold text-hb-cognac">
                  {user?.first_name} {user?.last_name}
                </h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Theme Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
          Utseende
        </h2>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-hb-sage/20 flex items-center justify-center">
                <Palette className="w-5 h-5 text-hb-cognac" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-sm">Tema</p>
                <p className="text-xs text-muted-foreground">Välj ljust, mörkt eller systemval</p>
              </div>
            </div>
            <ThemeToggle />
          </CardContent>
        </Card>
      </motion.div>

      {/* Menu Sections */}
      {menuItems.map((section, sectionIndex) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + sectionIndex * 0.05 }}
        >
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
            {section.title}
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y divide-border">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-hb-sage/20 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-hb-cognac" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Other Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0 divide-y divide-border">
            <Link
              href="/help"
              className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Hjälp & Support</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
            <Link
              href="/privacy"
              className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Integritetspolicy</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </motion.div>

      {/* Logout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Button
          variant="outline"
          className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logga ut
        </Button>
      </motion.div>

      {/* Version */}
      <p className="text-center text-xs text-muted-foreground">
        Homebase v2.0.0
      </p>
    </div>
  )
}

