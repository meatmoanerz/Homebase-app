'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { motion } from 'framer-motion'
import { ArrowLeft, Bell, BellRing, Smartphone, Send, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useNotificationSettings, useSaveNotificationSettings } from '@/hooks/use-notification-settings'
import {
  pushSupported,
  enablePushOnThisDevice,
  disablePushOnThisDevice,
  isPushEnabledOnThisDevice,
} from '@/lib/push/client'

const WEEKDAYS = [
  { value: 0, label: 'Söndag' },
  { value: 1, label: 'Måndag' },
  { value: 2, label: 'Tisdag' },
  { value: 3, label: 'Onsdag' },
  { value: 4, label: 'Torsdag' },
  { value: 5, label: 'Fredag' },
  { value: 6, label: 'Lördag' },
]

export default function NotificationSettingsPage() {
  const router = useRouter()
  const { data: settings, isLoading } = useNotificationSettings()
  const saveSettings = useSaveNotificationSettings()

  const [deviceEnabled, setDeviceEnabled] = useState(false)
  const [deviceBusy, setDeviceBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    setSupported(pushSupported())
    isPushEnabledOnThisDevice().then(setDeviceEnabled)
  }, [])

  const reminderEnabled = settings?.import_reminder_enabled ?? false
  const reminderDay = settings?.import_reminder_day ?? 0

  const handleToggleDevice = async () => {
    setDeviceBusy(true)
    try {
      if (deviceEnabled) {
        await disablePushOnThisDevice()
        setDeviceEnabled(false)
        toast.success('Notiser avstängda på denna enhet')
      } else {
        const result = await enablePushOnThisDevice()
        if (result.ok) {
          setDeviceEnabled(true)
          toast.success('Notiser aktiverade på denna enhet!')
        } else {
          toast.error(result.error || 'Kunde inte aktivera notiser')
        }
      }
    } catch {
      toast.error('Något gick fel')
    } finally {
      setDeviceBusy(false)
    }
  }

  const handleToggleReminder = async (enabled: boolean) => {
    try {
      await saveSettings.mutateAsync({
        import_reminder_enabled: enabled,
        import_reminder_day: reminderDay,
      })
      toast.success(enabled ? 'Importpåminnelser på' : 'Importpåminnelser av')
    } catch {
      toast.error('Kunde inte spara')
    }
  }

  const handleChangeDay = async (day: string) => {
    try {
      await saveSettings.mutateAsync({
        import_reminder_enabled: reminderEnabled,
        import_reminder_day: parseInt(day, 10),
      })
      toast.success('Påminnelsedag sparad')
    } catch {
      toast.error('Kunde inte spara')
    }
  }

  const handleTest = async () => {
    setTestBusy(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Testnotis skickad till ${data.sent} enhet(er)`)
      } else {
        toast.error(data.error || 'Kunde inte skicka testnotis')
      }
    } catch {
      toast.error('Kunde inte skicka testnotis')
    } finally {
      setTestBusy(false)
    }
  }

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-hb-cognac">Notiser</h1>
          <p className="text-sm text-muted-foreground">Påminnelser för transaktionsimport</p>
        </div>
      </motion.div>

      {/* Device */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-hb-sage/20 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-hb-cognac" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Denna enhet</CardTitle>
                <CardDescription className="text-xs">
                  Notiser aktiveras per enhet — gör detta på både din och Amandas mobil
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!supported && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Push stöds inte här. På iPhone: öppna Homebase från hemskärmen (inte i Safari-flik).
                </p>
              </div>
            )}
            <Button
              className="w-full h-11"
              variant={deviceEnabled ? 'outline' : 'default'}
              disabled={!supported || deviceBusy}
              onClick={handleToggleDevice}
            >
              {deviceBusy ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : deviceEnabled ? (
                <Bell className="w-4 h-4 mr-2" />
              ) : (
                <BellRing className="w-4 h-4 mr-2" />
              )}
              {deviceEnabled ? 'Stäng av notiser på denna enhet' : 'Aktivera notiser på denna enhet'}
            </Button>
            {deviceEnabled && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                disabled={testBusy}
                onClick={handleTest}
              >
                {testBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Skicka testnotis
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Import reminder */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-hb-terracotta/10 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-hb-terracotta" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Importpåminnelse</CardTitle>
                  <CardDescription className="text-xs">
                    Veckovis påminnelse att ladda upp banktransaktioner
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={reminderEnabled}
                disabled={isLoading || saveSettings.isPending}
                onCheckedChange={handleToggleReminder}
              />
            </div>
          </CardHeader>
          {reminderEnabled && (
            <CardContent className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Påminnelsedag</p>
              <Select value={String(reminderDay)} onValueChange={handleChangeDay}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day) => (
                    <SelectItem key={day.value} value={String(day.value)}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Notisen skickas på morgonen (ca kl 09–10) på vald dag.
              </p>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
