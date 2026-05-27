'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { motion } from 'framer-motion'
import { ArrowLeft, CreditCard, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

export default function CCMSettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  const { data: user, isLoading } = useUser()

  const [ccmEnabled, setCcmEnabled] = useState(false)
  const [invoiceBreakDate, setInvoiceBreakDate] = useState('1')
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize values when user loads
  useEffect(() => {
    if (user && !initialized) {
      setCcmEnabled(user.ccm_enabled || false)
      setInvoiceBreakDate((user.ccm_invoice_break_date || 1).toString())
      setInitialized(true)
    }
  }, [user, initialized])

  if (isLoading) {
    return <LoadingPage />
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        ccm_enabled: ccmEnabled,
        ccm_invoice_break_date: parseInt(invoiceBreakDate),
      })
      .eq('id', user.id)

    if (error) {
      toast.error('Kunde inte spara inställningar')
    } else {
      toast.success('CCM-inställningar sparade!')
      queryClient.invalidateQueries({ queryKey: ['user'] })
      router.push('/settings/ccm')
    }
    setSaving(false)
  }

  return (
    <div className="p-4 space-y-6">
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
          <h1 className="text-xl font-bold text-hb-cognac">CCM-inställningar</h1>
          <p className="text-sm text-muted-foreground">Konfigurera kreditkortshanteraren</p>
        </div>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-0 shadow-sm bg-hb-sand-deep/30">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-hb-terracotta shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-hb-cognac mb-1">Vad är CCM?</p>
                <p className="text-muted-foreground">
                  Credit Card Manager (CCM) hjälper dig separera utgifter som betalas med
                  kreditkort från direkta betalningar. Detta ger bättre överblick över
                  ditt kassaflöde och gör det enkelt att stämma av fakturan.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Inställningar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable CCM */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Aktivera CCM</Label>
                <p className="text-sm text-muted-foreground">
                  Visa alternativ för kreditkortsutgifter
                </p>
              </div>
              <Switch
                checked={ccmEnabled}
                onCheckedChange={setCcmEnabled}
              />
            </div>

            {/* Invoice Break Date */}
            {ccmEnabled && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Fakturabrytdatum</Label>
                <Select value={invoiceBreakDate} onValueChange={setInvoiceBreakDate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        Den {day}:e varje månad
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Utgifter efter detta datum hamnar på nästa månads faktura
                </p>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Sparar...' : 'Spara inställningar'}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* How it works */}
      {ccmEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Så fungerar det</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-hb-tim/20 flex items-center justify-center text-sm font-bold text-hb-cognac">
                  1
                </div>
                <div>
                  <p className="font-medium text-sm">Markera utgifter</p>
                  <p className="text-xs text-muted-foreground">
                    Vid varje utgift kan du välja "Betald med kreditkort"
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-hb-tim/20 flex items-center justify-center text-sm font-bold text-hb-cognac">
                  2
                </div>
                <div>
                  <p className="font-medium text-sm">Ange fakturabelopp</p>
                  <p className="text-xs text-muted-foreground">
                    När fakturan kommer, ange det faktiska beloppet
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-hb-tim/20 flex items-center justify-center text-sm font-bold text-hb-cognac">
                  3
                </div>
                <div>
                  <p className="font-medium text-sm">Betalningsfördelning</p>
                  <p className="text-xs text-muted-foreground">
                    Se hur fakturan delas mellan dig och din partner
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
