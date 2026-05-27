'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield } from 'lucide-react'

export default function PrivacyPage() {
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
          <h1 className="text-xl font-bold text-hb-cognac">Integritetspolicy</h1>
          <p className="text-sm text-muted-foreground">Hur vi hanterar din data</p>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-hb-sage/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-hb-cognac" />
              </div>
              <div>
                <h2 className="font-semibold">Din data, ditt ansvar</h2>
                <p className="text-sm text-muted-foreground">Senast uppdaterad: Januari 2026</p>
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="font-medium text-hb-cognac">1. Vilken data samlar vi in?</h3>
              <p className="text-sm text-muted-foreground">
                Homebase samlar in den information du frivilligt anger, inklusive:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Kontoinformation (e-post, namn)</li>
                <li>Ekonomisk data (utgifter, budgetar, inkomster)</li>
                <li>Inställningar och preferenser</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium text-hb-cognac">2. Hur använder vi din data?</h3>
              <p className="text-sm text-muted-foreground">
                Din data används uteslutande för att tillhandahålla Homebase-tjänsten:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Visa dina utgifter och budgetar</li>
                <li>Synkronisera med partner om du valt det</li>
                <li>Generera statistik och rapporter för dig</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium text-hb-cognac">3. Datadelning</h3>
              <p className="text-sm text-muted-foreground">
                Vi delar aldrig din ekonomiska data med tredje part. Din data stannar hos dig.
                Om du kopplar ett partnerkonto delas endast den data du explicit markerar som delad.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium text-hb-cognac">4. Säkerhet</h3>
              <p className="text-sm text-muted-foreground">
                All data överförs krypterad (HTTPS) och lagras säkert hos Supabase med
                Row Level Security (RLS) som säkerställer att du endast kan se din egen data.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium text-hb-cognac">5. Radering av data</h3>
              <p className="text-sm text-muted-foreground">
                Du kan när som helst kontakta oss för att radera ditt konto och all tillhörande data.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium text-hb-cognac">6. Kontakt</h3>
              <p className="text-sm text-muted-foreground">
                Har du frågor om hur vi hanterar din data? Kontakta oss via appen eller e-post.
              </p>
            </section>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
