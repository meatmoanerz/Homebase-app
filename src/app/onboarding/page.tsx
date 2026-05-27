'use client'

import { useState, useEffect, useRef } from 'react'
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
import { ArrowRight, ArrowLeft, User, Calendar, Wallet, Users, Sparkles, Check, Copy, Loader2 } from 'lucide-react'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

const STEPS = [
  { id: 'name', title: 'Vad heter du?', description: 'Vi vill lära känna dig' },
  { id: 'salary', title: 'När får du lön?', description: 'Vi anpassar din budget efter din löneperiod' },
  { id: 'income', title: 'Vad är din inkomst?', description: 'Du kan lägga till fler inkomster senare' },
  { id: 'partner', title: 'Har du en partner?', description: 'Ni kan dela budget och utgifter' },
  { id: 'complete', title: 'Allt klart!', description: 'Du är redo att börja använda Homebase' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [salaryDay, setSalaryDay] = useState('25')
  const [incomeName, setIncomeName] = useState('Lön')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [partnerChoice, setPartnerChoice] = useState<'skip' | 'invite' | 'code' | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const isCompletingRef = useRef(false) // Prevent double submission
  
  const router = useRouter()
  const supabase = createClient()

  // Load user profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        
        setUserId(user.id)

        // Try to get profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single() as { data: Profile | null }

        if (profile) {
          // If onboarding is already completed, redirect to dashboard
          if (profile.onboarding_completed) {
            router.replace('/dashboard')
            return
          }

          // Pre-fill from profile if available
          if (profile.first_name) setFirstName(profile.first_name)
          if (profile.last_name) setLastName(profile.last_name)
          if (profile.salary_day) setSalaryDay(profile.salary_day.toString())
        } else {
          // Get name from user metadata if profile doesn't exist
          const metadata = user.user_metadata
          if (metadata?.first_name) setFirstName(metadata.first_name)
          if (metadata?.last_name) setLastName(metadata.last_name)
          if (metadata?.name) {
            const parts = metadata.name.split(' ')
            setFirstName(parts[0] || '')
            setLastName(parts.slice(1).join(' ') || '')
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setInitialLoading(false)
      }
    }

    loadProfile()
  }, [supabase, router])

  const progress = ((step + 1) / STEPS.length) * 100

  async function generateInviteCode() {
    if (!userId) return
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    setGeneratedCode(code)
    
    try {
      // Delete any existing pending invites from this user first
      await supabase
        .from('partner_connections')
        .delete()
        .eq('initiated_by', userId)
        .eq('status', 'pending')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('partner_connections') as any).insert({
        user1_id: userId,
        user2_id: userId, // Placeholder
        initiated_by: userId,
        invite_code: code,
        status: 'pending',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      })
    } catch (error) {
      console.error('Error creating invite:', error)
    }
  }

  async function handleNext() {
    if (step === STEPS.length - 1) {
      await completeOnboarding()
      return
    }
    setStep(step + 1)
  }

  function handleBack() {
    if (step > 0) setStep(step - 1)
  }

  async function completeOnboarding() {
    // Prevent double submission
    if (!userId || isCompletingRef.current) return
    isCompletingRef.current = true
    setLoading(true)
    
    try {
      // Use API route for all updates (bypasses RLS issues)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const setupResponse = await fetch('/api/setup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: authUser?.email || '',
          firstName,
          lastName,
          salaryDay,
          onboardingCompleted: true, // Mark as completed
        }),
      })
      
      const setupResult = await setupResponse.json()
      console.log('Setup result:', setupResult)
      
      if (!setupResponse.ok) {
        console.error('Setup API error:', setupResult)
        throw new Error(setupResult.error || 'Failed to complete onboarding')
      }

      // Create income if provided - check for existing first
      if (incomeAmount && parseFloat(incomeAmount) > 0) {
        try {
          // Check if income with same name already exists
          const { data: existingIncome } = await supabase
            .from('incomes')
            .select('id')
            .eq('user_id', userId)
            .eq('name', incomeName || 'Lön')
            .maybeSingle()

          if (!existingIncome) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('incomes') as any).insert({
              user_id: userId,
              name: incomeName || 'Lön',
              amount: parseFloat(incomeAmount),
            })
          } else {
            // Update existing income instead
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('incomes') as any)
              .update({ amount: parseFloat(incomeAmount) })
              .eq('id', (existingIncome as { id: string }).id)
          }
        } catch (incomeError) {
          console.error('Income creation error (non-fatal):', incomeError)
        }
      }

      // Wait a bit for Supabase to sync
      await new Promise(resolve => setTimeout(resolve, 500))

      toast.success('Välkommen till Homebase! 🎉')
      
      // Use replace instead of push to prevent going back
      router.replace('/dashboard')
      router.refresh() // Force refresh to get updated data
    } catch (error) {
      console.error('Onboarding error:', error)
      toast.error('Något gick fel. Försök igen.')
      isCompletingRef.current = false // Allow retry on error
    } finally {
      setLoading(false)
    }
  }

  const isStepValid = () => {
    switch (step) {
      case 0: return firstName.trim().length > 0
      case 1: return salaryDay !== ''
      case 2: return true // Income is optional
      case 3: return true // Partner is optional
      case 4: return true
      default: return false
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hb-sand via-hb-sand-deep/30 to-hb-sage/50">
        <Loader2 className="w-8 h-8 animate-spin text-hb-cognac" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-hb-sand via-hb-sand-deep/30 to-hb-sage/50">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Steg {step + 1} av {STEPS.length}
            </span>
            <span className="text-sm font-medium text-hb-cognac">
              {Math.round(progress)}%
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
            transition={{ duration: 0.3 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-card/90 backdrop-blur">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-hb-sage/30 flex items-center justify-center mb-4">
                  {step === 0 && <User className="w-6 h-6 text-hb-cognac" />}
                  {step === 1 && <Calendar className="w-6 h-6 text-hb-cognac" />}
                  {step === 2 && <Wallet className="w-6 h-6 text-hb-cognac" />}
                  {step === 3 && <Users className="w-6 h-6 text-hb-cognac" />}
                  {step === 4 && <Sparkles className="w-6 h-6 text-hb-cognac" />}
                </div>
                <CardTitle className="text-xl">{STEPS[step].title}</CardTitle>
                <CardDescription>{STEPS[step].description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Step 0: Name */}
                {step === 0 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Förnamn *</Label>
                      <Input
                        id="firstName"
                        placeholder="Anna"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                        autoFocus
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
                  </>
                )}

                {/* Step 1: Salary Day */}
                {step === 1 && (
                  <div className="space-y-2">
                    <Label>Vilken dag i månaden får du lön?</Label>
                    <Select value={salaryDay} onValueChange={setSalaryDay}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Välj dag" />
                      </SelectTrigger>
                      <SelectContent>
                        {[25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 10, 15, 20].map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            Den {day}:e
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      Detta hjälper oss att visa rätt budgetperiod för dig.
                    </p>
                  </div>
                )}

                {/* Step 2: Income */}
                {step === 2 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="incomeName">Typ av inkomst</Label>
                      <Input
                        id="incomeName"
                        placeholder="Lön"
                        value={incomeName}
                        onChange={(e) => setIncomeName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incomeAmount">Belopp (efter skatt)</Label>
                      <div className="relative">
                        <Input
                          id="incomeAmount"
                          type="number"
                          placeholder="30000"
                          value={incomeAmount}
                          onChange={(e) => setIncomeAmount(e.target.value)}
                          className="pr-12"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                          kr
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Du kan hoppa över detta och lägga till senare.
                    </p>
                  </>
                )}

                {/* Step 3: Partner */}
                {step === 3 && (
                  <div className="space-y-4">
                    {!partnerChoice && (
                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          className="w-full h-14 justify-start px-4"
                          onClick={() => setPartnerChoice('invite')}
                        >
                          <Users className="mr-3 h-5 w-5" />
                          <div className="text-left">
                            <div className="font-medium">Bjud in partner</div>
                            <div className="text-xs text-muted-foreground">Skapa en inbjudningskod</div>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full h-14 justify-start px-4"
                          onClick={() => setPartnerChoice('code')}
                        >
                          <ArrowRight className="mr-3 h-5 w-5" />
                          <div className="text-left">
                            <div className="font-medium">Ange kod</div>
                            <div className="text-xs text-muted-foreground">Jag har fått en kod</div>
                          </div>
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => setPartnerChoice('skip')}
                        >
                          Hoppa över för nu
                        </Button>
                      </div>
                    )}

                    {partnerChoice === 'invite' && (
                      <div className="space-y-4">
                        {!generatedCode ? (
                          <Button
                            className="w-full"
                            onClick={generateInviteCode}
                          >
                            Generera inbjudningskod
                          </Button>
                        ) : (
                          <div className="p-4 bg-hb-sage/20 rounded-xl text-center">
                            <p className="text-sm text-muted-foreground mb-2">Din inbjudningskod:</p>
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-2xl font-bold tracking-widest text-hb-cognac">
                                {generatedCode}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  navigator.clipboard.writeText(generatedCode)
                                  toast.success('Kod kopierad!')
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Giltig i 1 timme
                            </p>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => setPartnerChoice(null)}
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Tillbaka
                        </Button>
                      </div>
                    )}

                    {partnerChoice === 'code' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="inviteCode">Ange kod</Label>
                          <Input
                            id="inviteCode"
                            placeholder="ABC123"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            className="text-center text-lg tracking-widest"
                            maxLength={6}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => setPartnerChoice(null)}
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Tillbaka
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Complete */}
                {step === 4 && (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                      <Check className="w-10 h-10 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-lg">Välkommen, {firstName}!</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        Du är nu redo att ta kontroll över din ekonomi.
                      </p>
                    </div>
                    <ul className="text-left space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        Profil skapad
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        Lönedag: den {salaryDay}:e
                      </li>
                      {incomeAmount && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-success" />
                          Inkomst: {parseInt(incomeAmount).toLocaleString('sv-SE')} kr
                        </li>
                      )}
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        Standardkategorier skapas
                      </li>
                    </ul>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-3 pt-4">
                  {step > 0 && step < 4 && (
                    <Button
                      variant="outline"
                      onClick={handleBack}
                      className="flex-1"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Tillbaka
                    </Button>
                  )}
                  <Button
                    onClick={handleNext}
                    disabled={!isStepValid() || loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sparar...
                      </>
                    ) : step === STEPS.length - 1 ? (
                      'Kom igång!'
                    ) : (
                      <>
                        Nästa
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
