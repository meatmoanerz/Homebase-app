'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  HelpCircle,
  Wallet,
  PiggyBank,
  CreditCard,
  Users,
  Calendar,
  TrendingUp
} from 'lucide-react'

const helpTopics = [
  {
    icon: Wallet,
    title: 'Utgiftshantering',
    description: 'Lägg till utgifter snabbt med kategori, belopp och datum. Markera om utgiften är delad med partner.',
  },
  {
    icon: Calendar,
    title: 'Budgetperioder',
    description: 'Budgetperioder följer din löndag. Om din löndag är 25:e räknas perioden från 25:e till 24:e nästa månad.',
  },
  {
    icon: PiggyBank,
    title: 'Sparkvot',
    description: 'Sparkvoten visar hur mycket av din inkomst du sparar. Faktisk sparkvot baseras på registrerat sparande.',
  },
  {
    icon: CreditCard,
    title: 'Kreditkortshanterare (CCM)',
    description: 'Aktivera CCM i inställningar för att separera kreditkortsutgifter från direkta utgifter.',
  },
  {
    icon: Users,
    title: 'Partnerkoppling',
    description: 'Koppla ihop konton med din partner för att se gemensamma utgifter och budgetar.',
  },
  {
    icon: TrendingUp,
    title: 'Återkommande utgifter',
    description: 'Registrera fasta utgifter som hyra, prenumerationer etc. De skapas automatiskt varje månad.',
  },
]

export default function HelpPage() {
  const router = useRouter()

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-hb-cognac">Hjälp & Support</h1>
          <p className="text-sm text-muted-foreground">Lär dig använda Homebase</p>
        </div>
      </motion.div>

      {/* Intro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-br from-hb-sage/20 to-hb-sage/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-hb-cognac/10 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-hb-cognac" />
              </div>
              <div>
                <h2 className="font-semibold text-hb-cognac">Välkommen till Homebase!</h2>
                <p className="text-sm text-muted-foreground">
                  Homebase hjälper dig hålla koll på din ekonomi enkelt och smart.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Help Topics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <h2 className="text-sm font-semibold text-muted-foreground px-1">Vanliga frågor</h2>
        {helpTopics.map((topic, index) => (
          <motion.div
            key={topic.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + index * 0.05 }}
          >
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-hb-sage/20 flex items-center justify-center shrink-0">
                    <topic.icon className="w-5 h-5 text-hb-cognac" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{topic.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-medium text-sm mb-2">Tips för bättre ekonomi</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Registrera utgifter direkt när de händer</li>
              <li>• Sätt upp realistiska budgetmål</li>
              <li>• Granska dina utgifter veckovis</li>
              <li>• Använd kategorier konsekvent</li>
              <li>• Sätt sparmål och följ upp regelbundet</li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      {/* Contact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <Card className="border-0 shadow-sm bg-hb-sand-deep/10">
          <CardContent className="p-4 text-center">
            <h3 className="font-medium text-sm mb-1">Behöver du mer hjälp?</h3>
            <p className="text-xs text-muted-foreground">
              Kontakta oss på support@stacka.app så hjälper vi dig!
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
