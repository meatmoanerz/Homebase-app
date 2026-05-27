'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useIncomes, useCreateIncome, useUpdateIncome, useDeleteIncome } from '@/hooks/use-incomes'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { formatCurrency } from '@/lib/utils/formatters'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Pencil, Loader2, CreditCard, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { useQueryClient } from '@tanstack/react-query'
import type { Income } from '@/types'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()
  
  const { data: user, isLoading: userLoading } = useUser()
  const { data: incomes = [], isLoading: incomesLoading } = useIncomes()
  
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [salaryDay, setSalaryDay] = useState('')
  const [saving, setSaving] = useState(false)

  // CCM Settings
  const [ccmEnabled, setCcmEnabled] = useState(false)
  const [ccmBreakDate, setCcmBreakDate] = useState('15')
  
  const [incomeDialog, setIncomeDialog] = useState<{ open: boolean; income?: Income }>({ open: false })
  const [incomeName, setIncomeName] = useState('')
  const [incomeAmount, setIncomeAmount] = useState('')
  
  const createIncome = useCreateIncome()
  const updateIncome = useUpdateIncome()
  const deleteIncome = useDeleteIncome()

  // Initialize form values when user loads
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name)
      setLastName(user.last_name)
      setSalaryDay(user.salary_day.toString())
      setCcmEnabled(user.ccm_enabled || false)
      setCcmBreakDate((user.ccm_invoice_break_date || 15).toString())
    }
  }, [user])

  if (userLoading || incomesLoading) {
    return <LoadingPage />
  }

  async function handleSaveProfile() {
    if (!user) return
    setSaving(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        salary_day: parseInt(salaryDay),
        ccm_enabled: ccmEnabled,
        ccm_invoice_break_date: parseInt(ccmBreakDate),
      })
      .eq('id', user.id)

    if (error) {
      toast.error('Kunde inte spara ändringar')
    } else {
      toast.success('Profil uppdaterad!')
      queryClient.invalidateQueries({ queryKey: ['user'] })
    }
    setSaving(false)
  }

  function openIncomeDialog(income?: Income) {
    setIncomeDialog({ open: true, income })
    setIncomeName(income?.name || '')
    setIncomeAmount(income?.amount.toString() || '')
  }

  async function handleSaveIncome() {
    if (!incomeName || !incomeAmount) return

    try {
      if (incomeDialog.income) {
        await updateIncome.mutateAsync({
          id: incomeDialog.income.id,
          name: incomeName,
          amount: parseFloat(incomeAmount),
        })
        toast.success('Inkomst uppdaterad!')
      } else {
        await createIncome.mutateAsync({
          user_id: user!.id,
          name: incomeName,
          amount: parseFloat(incomeAmount),
        })
        toast.success('Inkomst tillagd!')
      }
      setIncomeDialog({ open: false })
    } catch {
      toast.error('Något gick fel')
    }
  }

  async function handleDeleteIncome(id: string) {
    try {
      await deleteIncome.mutateAsync(id)
      toast.success('Inkomst borttagen')
    } catch {
      toast.error('Kunde inte ta bort inkomst')
    }
  }

  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0)

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
          <h1 className="text-xl font-bold text-hb-cognac">Profil</h1>
          <p className="text-sm text-muted-foreground">Personuppgifter och inställningar</p>
        </div>
      </motion.div>

      {/* Profile Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Personuppgifter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Förnamn</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Efternamn</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Löndag</Label>
              <Select value={salaryDay} onValueChange={setSalaryDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 10, 15, 20].map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Den {day}:e
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Budgetperioden baseras på din löndag
              </p>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sparar...
                </>
              ) : (
                'Spara ändringar'
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* CCM Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-hb-terracotta" />
              Credit Card Manager (CCM)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Separera kreditkortsutgifter från kassaflödet
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable CCM Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
              <div className="flex-1">
                <Label htmlFor="ccm_enabled" className="font-medium cursor-pointer">
                  Aktivera CCM
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Hantera kreditkortsutgifter separat från kontantkassaflödet
                </p>
              </div>
              <Switch
                id="ccm_enabled"
                checked={ccmEnabled}
                onCheckedChange={setCcmEnabled}
              />
            </div>

            {/* Billing Day Picker (only if CCM enabled) */}
            {ccmEnabled && (
              <div className="p-4 bg-hb-sand-deep/10 rounded-lg border border-hb-terracotta/20 space-y-3">
                <Label htmlFor="ccm_break_date">Fakturabrytdag</Label>
                <p className="text-xs text-muted-foreground">
                  Välj vilken dag kreditkortsfakturan stänger varje månad
                </p>
                <Select value={ccmBreakDate} onValueChange={setCcmBreakDate}>
                  <SelectTrigger id="ccm_break_date">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...Array(28)].map((_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        Den {i + 1}:e
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>
                    <strong>Exempel:</strong> Om brytdag är 15:e, så tillhör köp 1-15 dec samma faktura (betalas 15 jan).
                    Köp 16-31 dec tillhör nästa faktura (betalas 15 feb).
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Incomes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Inkomster</CardTitle>
              <p className="text-sm text-muted-foreground">
                Totalt: {formatCurrency(totalIncome)}/mån
              </p>
            </div>
            <Button size="sm" onClick={() => openIncomeDialog()}>
              <Plus className="w-4 h-4 mr-1" />
              Lägg till
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {incomes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Inga inkomster registrerade
              </p>
            ) : (
              incomes.map((income) => (
                <div
                  key={income.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30"
                >
                  <div>
                    <p className="font-medium text-sm">{income.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(income.amount)}/mån
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openIncomeDialog(income)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteIncome(income.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Income Dialog */}
      <Dialog open={incomeDialog.open} onOpenChange={(open) => setIncomeDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {incomeDialog.income ? 'Redigera inkomst' : 'Lägg till inkomst'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="incomeName">Namn</Label>
              <Input
                id="incomeName"
                placeholder="T.ex. Lön, Barnbidrag"
                value={incomeName}
                onChange={(e) => setIncomeName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incomeAmount">Belopp per månad</Label>
              <div className="relative">
                <Input
                  id="incomeAmount"
                  type="number"
                  placeholder="0"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  className="pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  kr
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncomeDialog({ open: false })}>
              Avbryt
            </Button>
            <Button onClick={handleSaveIncome}>
              {incomeDialog.income ? 'Spara' : 'Lägg till'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

