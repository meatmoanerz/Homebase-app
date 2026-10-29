'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser, useSetCCMEnabled } from '@/hooks/use-user'
import { useImportBatches } from '@/hooks/use-import-staging'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { getInitials } from '@/lib/utils/formatters'
import { motion } from 'framer-motion'
import {
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
  Receipt,
  Bell
} from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ui/theme-toggle'

/** Everyday money tools — the "Mer" hub's first section, as tiles. */
const economyItems = [
  { href: '/import', label: 'Importera', icon: FileSearch, description: 'Transaktioner att granska', badge: 'import' as const },
  { href: '/savings', label: 'Sparmål', icon: Target, description: 'Mål och framsteg' },
  { href: '/settings/loans', label: 'Lån', icon: Landmark, description: 'Saldo och amortering' },
  { href: '/receipts', label: 'Kvitton', icon: Receipt, description: 'Inköp och priser' },
  { href: '/settings/shared-account', label: 'Gemensam ekonomi', icon: Wallet, description: 'Månadens överföringar' },
  { href: '/settings/ccm', label: 'Kreditkort', icon: CreditCard, description: 'Fakturor och kort' },
]

const menuItems = [
  {
    title: 'Konto',
    items: [
      { href: '/settings/partner', label: 'Partner', icon: Users, description: 'Koppla ihop konton' },
      { href: '/settings/notifications', label: 'Notiser', icon: Bell, description: 'Påminnelser för transaktionsimport' },
    ]
  },
  {
    title: 'Kategorier',
    items: [
      { href: '/settings/categories', label: 'Kategorier', icon: FolderOpen, description: 'Hantera kostnadskategorier' },
      { href: '/settings/mappings', label: 'Kategoriregler', icon: Sparkles, description: 'Auto-kategorisering vid import' },
      { href: '/settings/household-categories', label: 'Hushållskostnader', icon: Home, description: 'Kategorier för hushållskostnader' },
    ]
  },
]

export default function SettingsPage() {
  const { data: user, isLoading } = useUser()
  const { data: batches = [] } = useImportBatches()
  const pendingImports = batches.reduce((sum, b) => sum + b.row_count, 0)
  const setCCMEnabled = useSetCCMEnabled()
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
    <div className="p-4 space-y-5">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link
          href="/settings/profile"
          className="flex items-center gap-3 bg-card rounded-2xl shadow-sm p-3.5 hover:bg-muted/30 transition-colors"
        >
          <Avatar className="w-11 h-11">
            <AvatarImage src={user?.avatar_url || undefined} alt="" />
            <AvatarFallback className="bg-hb-sage text-hb-cognac">
              {getInitials(user?.first_name || '', user?.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-hb-cognac truncate">
              {user?.first_name} {user?.last_name}
            </h1>
            <p className="text-xs text-muted-foreground truncate">Profil, löndag och inkomster</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
        </Link>
      </motion.div>

      {/* Economy tools */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Ekonomi</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {economyItems.map((item) => {
            const badge = item.badge === 'import' && pendingImports > 0 ? pendingImports : null
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative bg-card rounded-2xl shadow-sm p-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-hb-sage/20 flex items-center justify-center">
                  <item.icon className="w-[18px] h-[18px] text-hb-cognac" aria-hidden="true" />
                </div>
                <p className="font-medium text-sm mt-2.5">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
                {badge != null && (
                  <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 rounded-full bg-hb-terracotta text-white text-[11px] font-semibold grid place-items-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
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
            {sectionIndex === 0 ? `Inställningar · ${section.title}` : section.title}
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

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
          Funktioner
        </h2>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 p-4">
              <label htmlFor="ccm-enabled" className="flex items-center gap-3 min-w-0 cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-hb-sage/20 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-hb-cognac" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">Kreditkortshanterare</p>
                  <p className="text-xs text-muted-foreground">Håll kortköp separat från kassaflödet</p>
                </div>
              </label>
              <Switch
                id="ccm-enabled"
                checked={!!user?.ccm_enabled}
                disabled={!user || setCCMEnabled.isPending}
                onCheckedChange={(enabled) => user && setCCMEnabled.mutate({ userId: user.id, enabled })}
              />
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

