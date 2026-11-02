'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ArrowLeft, User, Wallet, Users, Sparkles, Check, Copy, Loader2, Scale,
  LayoutGrid, Target, Landmark, CreditCard, Receipt, PlusCircle, FileSearch, Home, UtensilsCrossed,
} from 'lucide-react'
import { HouseholdModelPicker, GENERIC_MODEL_EXAMPLES } from '@/components/household/household-model-picker'
import { HOUSEHOLD_MODEL_LABELS, type HouseholdModel } from '@/lib/household/economy'
import { getCurrentBudgetPeriod } from '@/lib/utils/budget-period'
import { MODULE_INFO, type OptionalModule } from '@/lib/onboarding/modules'
import { generateInviteCode as makeInviteCode, INVITE_TTL_MS } from '@/lib/onboarding/invite-code'
import { cn } from '@/lib/utils/cn'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type StepId = 'about' | 'income' | 'partner' | 'economy' | 'modules' | 'complete'

const STEP_META: Record<StepId, { title: string; description: string; icon: typeof User }> = {
  about: { title: 'Välkommen till Homebase', description: 'Två snabba frågor så att budgeten följer din lön', icon: User },
  income: { title: 'Vad får du ut i lön?', description: 'Används för att räkna ut vad du har kvar att budgetera', icon: Wallet },
  partner: { title: 'Delar du ekonomi med någon?', description: 'Ni ser varandras delade utgifter och budget', icon: Users },
  economy: { title: 'Hur delar ni på ekonomin?', description: 'Exemplen utgår från en hyra på 10 000 kr', icon: Scale },
  modules: { title: 'Vad vill du hålla koll på?', description: 'Översikt, utgifter och budget ingår alltid. Välj till fler delar om du vill', icon: LayoutGrid },
  complete: { title: 'Allt är klart!', description: 'Var vill du börja?', icon: Sparkles },
}

const MODULE_ICONS: Record<OptionalModule, typeof User> = {
  savings: Target,
  loans: Landmark,
  ccm: CreditCard,
  receipts: Receipt,
  shared: Wallet,
  meals: UtensilsCrossed,
}

// Shared economy only makes sense with a partner, so it is offered there only.
const SOLO_MODULES: OptionalModule[] = ['savings', 'loans', 'ccm', 'receipts']
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

const JOIN_ERRORS: Record<string, string> = {
  invalid_or_expired_code: 'Koden finns inte eller har gått ut. Be din partner skapa en ny.',
  cannot_join_own_invite: 'Det där är din egen kod. Ange koden du fått av din partner.',
  already_connected: 'Någon av er är redan kopplad till en partner.',
}

export default function OnboardingPage() {
  const [stepIndex, setStepIndex] = useState(0)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [salaryDay, setSalaryDay] = useState('25')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [partnerChoice, setPartnerChoice] = useState<'skip' | 'invite' | 'code' | null>(null)
  const [economyModel, setEconomyModel] = useState<HouseholdModel>('budget')
  const [inviteCode, setInviteCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [joinedPartner, setJoinedPartner] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [modules, setModules] = useState<OptionalModule[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const isCompletingRef = useRef(false)

  const router = useRouter()
  const supabase = createClient()

  const withPartner = partnerChoice === 'invite' || joinedPartner

  // Economy is only asked together with a partner.
  const steps = useMemo<StepId[]>(
    () => ['about', 'income', 'partner', ...(withPartner ? (['economy'] as StepId[]) : []), 'modules', 'complete'],
    [withPartner]
  )
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const meta = STEP_META[step]
  const StepIcon = meta.icon
  const progress = ((stepIndex + 1) / steps.length) * 100

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        setUserId(user.id)

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle() as { data: Profile | null }

        if (profile?.onboarding_completed) {
          router.replace('/dashboard')
          return
        }

        const metadata = user.user_metadata ?? {}
        const metaFirst = metadata.first_name || (typeof metadata.name === 'string' ? metadata.name.split(' ')[0] : '')
        const metaLast = metadata.last_name || (typeof metadata.name === 'string' ? metadata.name.split(' ').slice(1).join(' ') : '')
        // The DB trigger fills first_name with a placeholder until onboarding.
        setFirstName(metaFirst || profile?.first_name || '')
        setLastName(metaLast || profile?.last_name || '')
        if (profile?.salary_day) setSalaryDay(profile.salary_day.toString())
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setInitialLoading(false)
      }
    }
    loadProfile()
  }, [supabase, router])

  // Partner users most likely want the shared overview; preselect it once.
  useEffect(() => {
    if (withPartner) setModules((m) => (m.includes('shared') ? m : [...m, 'shared']))
    else setModules((m) => m.filter((x) => x !== 'shared'))
  }, [withPartner])

  async function createInviteCode() {
    if (!userId) return
    const code = makeInviteCode()
    try {
      await supabase
        .from('partner_connections')
        .delete()
        .eq('initiated_by', userId)
        .eq('status', 'pending')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('partner_connections') as any).insert({
        user1_id: userId,
        user2_id: userId, // Placeholder until the partner joins
        initiated_by: userId,
        invite_code: code,
        status: 'pending',
        expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      })
      if (error) throw error
      setGeneratedCode(code)
    } catch (error) {
      console.error('Error creating invite:', error)
      toast.error('Kunde inte skapa en kod. Försök igen.')
    }
  }

  async function joinWithCode(): Promise<boolean> {
    setJoinError('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('join_partner_connection', {
      p_invite_code: inviteCode.trim().toUpperCase(),
      p_user_id: userId,
    })
    if (error || !data?.success) {
      setJoinError(JOIN_ERRORS[data?.error as string] ?? 'Kunde inte koppla ihop er. Försök igen.')
      return false
    }
    setJoinedPartner(true)
    toast.success('Ni är nu ihopkopplade!')
    return true
  }

  async function handleNext() {
    if (step === 'partner' && partnerChoice === 'code' && !joinedPartner) {
      setLoading(true)
      const ok = await joinWithCode()
      setLoading(false)
      // Joining changes the step list (economy appears); move to it explicitly.
      if (ok) setStepIndex(steps.indexOf('partner') + 1)
      return
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }

  function handleBack() {
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  function toggleModule(module: OptionalModule) {
    setModules((current) => (current.includes(module) ? current.filter((m) => m !== module) : [...current, module]))
  }

  async function completeOnboarding(destination: string) {
    if (!userId || isCompletingRef.current) return
    isCompletingRef.current = true
    setLoading(true)

    try {
      const setupResponse = await fetch('/api/setup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          salaryDay,
          enabledModules: modules,
          onboardingCompleted: true,
        }),
      })
      if (!setupResponse.ok) {
        const result = await setupResponse.json().catch(() => ({}))
        throw new Error(result.error || 'Failed to complete onboarding')
      }

      const amount = parseFloat(incomeAmount)
      if (amount > 0) {
        try {
          const { data: existingIncome } = await supabase
            .from('incomes')
            .select('id')
            .eq('user_id', userId)
            .eq('name', 'Lön')
            .maybeSingle()

          if (!existingIncome) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('incomes') as any).insert({ user_id: userId, name: 'Lön', amount })
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('incomes') as any)
              .update({ amount })
              .eq('id', (existingIncome as { id: string }).id)
          }
        } catch (incomeError) {
          console.error('Income creation error (non-fatal):', incomeError)
        }

        // The budget and the income reminder read the period's income, not the
        // standing one above, so register it for the running period too.
        try {
          const period = getCurrentBudgetPeriod(parseInt(salaryDay) || 25).period
          const { data: existingMonthly } = await supabase
            .from('monthly_incomes')
            .select('id')
            .eq('user_id', userId)
            .eq('period', period)
            .eq('name', 'Lön')
            .maybeSingle()
          if (!existingMonthly) {
            await fetch('/api/monthly-incomes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ period, name: 'Lön', amount }),
            })
          }
        } catch (monthlyError) {
          console.error('Monthly income creation error (non-fatal):', monthlyError)
        }
      }

      if (withPartner) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('shared_account_defaults') as any).upsert(
            {
              user_id: userId,
              effective_from: getCurrentBudgetPeriod(parseInt(salaryDay) || 25).period,
              model: economyModel,
            },
            { onConflict: 'user_id,effective_from' }
          )
        } catch (economyError) {
          console.error('Household model error (non-fatal):', economyError)
        }
      }

      toast.success(`Välkommen, ${firstName}!`)
      router.replace(destination)
      router.refresh()
    } catch (error) {
      console.error('Onboarding error:', error)
      toast.error('Något gick fel. Försök igen.')
      isCompletingRef.current = false
      setLoading(false)
    }
  }

  const isStepValid = () => {
    switch (step) {
      case 'about': return firstName.trim().length > 0 && salaryDay !== ''
      case 'partner':
        if (partnerChoice === 'code') return joinedPartner || inviteCode.trim().length === 6
        return partnerChoice !== null
      default: return true
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hb-sand via-hb-sand-deep/30 to-hb-sage/50">
        <Loader2 className="w-8 h-8 animate-spin text-hb-cognac" />
      </div>
    )
  }

  const offeredModules: OptionalModule[] = withPartner ? [...SOLO_MODULES, 'shared'] : SOLO_MODULES

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-hb-sand via-hb-sand-deep/30 to-hb-sage/50">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Steg {stepIndex + 1} av {steps.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-card/90 backdrop-blur">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-hb-sage/30 flex items-center justify-center mb-4">
                  <StepIcon className="w-6 h-6 text-hb-cognac" />
                </div>
                <CardTitle className="text-xl">{meta.title}</CardTitle>
                <CardDescription>{meta.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {step === 'about' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Förnamn</Label>
                        <Input
                          id="firstName"
                          placeholder="Anna"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          autoComplete="given-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Efternamn</Label>
                        <Input
                          id="lastName"
                          placeholder="Andersson"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salaryDay">Vilken dag får du lön?</Label>
                      <Select value={salaryDay} onValueChange={setSalaryDay}>
                        <SelectTrigger id="salaryDay" className="h-12">
                          <SelectValue placeholder="Välj dag" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map((day) => (
                            <SelectItem key={day} value={day.toString()}>
                              Den {day}:e
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Budgeten räknas från lön till lön, inte per kalendermånad.
                        Får du lön den 25:e gäller perioden 25:e–24:e.
                      </p>
                    </div>
                  </>
                )}

                {step === 'income' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="incomeAmount">Lön efter skatt per månad</Label>
                      <div className="relative">
                        <Input
                          id="incomeAmount"
                          type="number"
                          inputMode="numeric"
                          placeholder="30 000"
                          value={incomeAmount}
                          onChange={(e) => setIncomeAmount(e.target.value)}
                          className="pr-12 h-12"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">kr</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Har du fler inkomster, som barnbidrag eller hyresintäkt, lägger du till dem under Mer › Profil.
                      Du kan också hoppa över det här.
                    </p>
                  </>
                )}

                {step === 'partner' && (
                  <div className="space-y-4">
                    {(partnerChoice === null || partnerChoice === 'skip') && (
                      <div className="space-y-3">
                        <ChoiceButton
                          icon={Users}
                          title="Ja, bjud in min partner"
                          subtitle="Du får en kod att skicka"
                          onClick={() => { setPartnerChoice('invite'); if (!generatedCode) createInviteCode() }}
                        />
                        <ChoiceButton
                          icon={ArrowRight}
                          title="Jag har fått en kod"
                          subtitle="Min partner använder redan Homebase"
                          onClick={() => setPartnerChoice('code')}
                        />
                        <ChoiceButton
                          icon={User}
                          title="Nej, bara jag"
                          subtitle="Du kan bjuda in någon senare"
                          selected={partnerChoice === 'skip'}
                          onClick={() => setPartnerChoice('skip')}
                        />
                      </div>
                    )}

                    {partnerChoice === 'invite' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-hb-sage/20 rounded-xl text-center">
                          <p className="text-sm text-muted-foreground mb-2">Skicka den här koden till din partner</p>
                          {generatedCode ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-2xl font-bold tracking-widest text-hb-cognac">{generatedCode}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Kopiera koden"
                                onClick={() => {
                                  navigator.clipboard.writeText(generatedCode)
                                  toast.success('Koden är kopierad')
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-hb-cognac" />
                          )}
                          <p className="text-xs text-muted-foreground mt-3">
                            Din partner skapar ett konto och väljer &quot;Jag har fått en kod&quot;. Koden gäller i 24 timmar.
                            Du kan fortsätta direkt, ni kopplas ihop när koden används.
                          </p>
                        </div>
                        <Button variant="ghost" onClick={() => setPartnerChoice(null)}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Välj något annat
                        </Button>
                      </div>
                    )}

                    {partnerChoice === 'code' && (
                      <div className="space-y-4">
                        {joinedPartner ? (
                          <div className="p-4 bg-success/10 rounded-xl text-center text-sm">
                            <Check className="w-5 h-5 text-success mx-auto mb-1" />
                            Ni är ihopkopplade.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor="inviteCode">Koden från din partner</Label>
                            <Input
                              id="inviteCode"
                              placeholder="ABC123"
                              value={inviteCode}
                              onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setJoinError('') }}
                              className="text-center text-lg tracking-widest h-12"
                              maxLength={6}
                              autoCapitalize="characters"
                              autoComplete="off"
                            />
                            {joinError && <p className="text-sm text-destructive">{joinError}</p>}
                          </div>
                        )}
                        {!joinedPartner && (
                          <Button variant="ghost" onClick={() => { setPartnerChoice(null); setJoinError('') }}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Välj något annat
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {step === 'economy' && (
                  <div className="space-y-3">
                    <HouseholdModelPicker value={economyModel} onChange={setEconomyModel} examples={GENERIC_MODEL_EXAMPLES} />
                    <p className="text-xs text-muted-foreground">
                      Ni kan ändra det när som helst under Mer › Partner.
                    </p>
                  </div>
                )}

                {step === 'modules' && (
                  <div className="space-y-2.5">
                    {offeredModules.map((id) => {
                      const info = MODULE_INFO[id]
                      const Icon = MODULE_ICONS[id]
                      const selected = modules.includes(id)
                      return (
                        <button
                          key={id}
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() => toggleModule(id)}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                            selected ? 'border-hb-cognac bg-hb-sage/20' : 'border-border hover:bg-muted/40'
                          )}
                        >
                          <div className="w-9 h-9 rounded-lg bg-hb-sage/25 flex items-center justify-center shrink-0">
                            <Icon className="w-[18px] h-[18px] text-hb-cognac" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{info.label}</p>
                            <p className="text-xs text-muted-foreground">{info.description}</p>
                          </div>
                          <div
                            className={cn(
                              'w-5 h-5 rounded-md border flex items-center justify-center shrink-0',
                              selected ? 'bg-hb-cognac border-hb-cognac' : 'border-muted-foreground/40'
                            )}
                          >
                            {selected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </button>
                      )
                    })}
                    <p className="text-xs text-muted-foreground pt-1">
                      Osäker? Hoppa över. Du slår på delar när du vill under Mer › Funktioner.
                    </p>
                  </div>
                )}

                {step === 'complete' && (
                  <div className="space-y-4">
                    <ul className="space-y-1.5 text-sm">
                      <SummaryRow>Lönedag den {salaryDay}:e</SummaryRow>
                      {parseFloat(incomeAmount) > 0 && (
                        <SummaryRow>Lön {parseInt(incomeAmount).toLocaleString('sv-SE')} kr</SummaryRow>
                      )}
                      {joinedPartner && <SummaryRow>Kopplad till din partner</SummaryRow>}
                      {partnerChoice === 'invite' && <SummaryRow>Inbjudan skickad ({generatedCode})</SummaryRow>}
                      {withPartner && <SummaryRow>Ekonomi: {HOUSEHOLD_MODEL_LABELS[economyModel]}</SummaryRow>}
                      {modules.length > 0 && (
                        <SummaryRow>Tillval: {modules.map((m) => MODULE_INFO[m].label).join(', ')}</SummaryRow>
                      )}
                    </ul>
                    <div className="space-y-2.5 pt-2">
                      <ChoiceButton
                        icon={FileSearch}
                        title="Importera från banken"
                        subtitle="Läs in en CSV-fil från SEB, Swedbank m.fl."
                        disabled={loading}
                        onClick={() => completeOnboarding('/import')}
                      />
                      <ChoiceButton
                        icon={PlusCircle}
                        title="Lägg till en utgift"
                        subtitle="Skriv in ett köp för hand"
                        disabled={loading}
                        onClick={() => completeOnboarding('/expenses')}
                      />
                      <ChoiceButton
                        icon={Home}
                        title="Visa översikten"
                        subtitle="Få en rundtur i appen först"
                        disabled={loading}
                        onClick={() => completeOnboarding('/dashboard')}
                      />
                    </div>
                    {loading && (
                      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sparar…
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  {stepIndex > 0 && (
                    <Button variant="outline" onClick={handleBack} className="flex-1" disabled={loading}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Tillbaka
                    </Button>
                  )}
                  {step !== 'complete' && (
                    <Button onClick={handleNext} disabled={!isStepValid() || loading} className="flex-1">
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : step === 'income' && !incomeAmount ? (
                        'Hoppa över'
                      ) : step === 'modules' && modules.length === 0 ? (
                        'Hoppa över'
                      ) : step === 'partner' && partnerChoice === 'code' && !joinedPartner ? (
                        'Koppla ihop'
                      ) : (
                        <>
                          Nästa
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function ChoiceButton({
  icon: Icon,
  title,
  subtitle,
  onClick,
  selected,
  disabled,
}: {
  icon: typeof User
  title: string
  subtitle: string
  onClick: () => void
  selected?: boolean
  disabled?: boolean
}) {
  return (
    <Button
      variant="outline"
      className={cn('w-full h-auto min-h-14 justify-start px-4 py-3', selected && 'border-hb-cognac bg-hb-sage/20')}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="mr-3 h-5 w-5 shrink-0" />
      <div className="text-left whitespace-normal">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </Button>
  )
}

function SummaryRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="h-4 w-4 text-success shrink-0" />
      <span>{children}</span>
    </li>
  )
}
