import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isOptionalModule, type OptionalModule } from '@/lib/onboarding/modules'

// Creates or updates the signed-in user's profile and seeds default categories.
// The user is always taken from the session cookie, never from the request
// body, so one user can never write to another user's profile.

const DEFAULT_CATEGORIES = [
  // Fixed expenses
  { name: 'A-Kassa', cost_type: 'Fixed', subcategory: 'Home', is_default: true },
  { name: 'Avgift', cost_type: 'Fixed', subcategory: 'Housing', is_default: true },
  { name: 'El', cost_type: 'Fixed', subcategory: 'Home', is_default: true },
  { name: 'Hemförsäkring', cost_type: 'Fixed', subcategory: 'Home', is_default: true },
  { name: 'Bilkostnader', cost_type: 'Fixed', subcategory: 'Housing', is_default: true },
  { name: 'Prenumerationer', cost_type: 'Fixed', subcategory: 'Home', is_default: true },
  { name: 'Ränta bolån', cost_type: 'Fixed', subcategory: 'Loans', is_default: true },
  { name: 'Övrig försäkring', cost_type: 'Fixed', subcategory: 'Home', is_default: true },
  { name: 'Övrigt Fast', cost_type: 'Fixed', subcategory: 'Other', is_default: true },
  // Variable expenses
  { name: 'Mat', cost_type: 'Variable', subcategory: 'Home', is_default: true },
  { name: 'Hem', cost_type: 'Variable', subcategory: 'Home', is_default: true },
  { name: 'Kläder', cost_type: 'Variable', subcategory: 'Home', is_default: true },
  { name: 'Kollektivtrafik', cost_type: 'Variable', subcategory: 'Transport', is_default: true },
  { name: 'Drivmedel bil', cost_type: 'Variable', subcategory: 'Transport', is_default: true },
  { name: 'Nöje', cost_type: 'Variable', subcategory: 'Entertainment', is_default: true },
  { name: 'Restaurang', cost_type: 'Variable', subcategory: 'Entertainment', is_default: true },
  { name: 'Resor', cost_type: 'Variable', subcategory: 'Entertainment', is_default: true },
  { name: 'CSN', cost_type: 'Variable', subcategory: 'Other', is_default: true },
  { name: 'Övriga lån', cost_type: 'Variable', subcategory: 'Loans', is_default: true },
  { name: 'Kreditkort', cost_type: 'Variable', subcategory: 'Other', is_default: true },
  { name: 'Övrigt Rörligt', cost_type: 'Variable', subcategory: 'Other', is_default: true },
  // Savings
  { name: 'Amortering', cost_type: 'Savings', subcategory: 'Savings', is_default: true },
  { name: 'Buffert', cost_type: 'Savings', subcategory: 'Savings', is_default: true },
  { name: 'Boendespar', cost_type: 'Savings', subcategory: 'Savings', is_default: true },
  { name: 'Resespar', cost_type: 'Savings', subcategory: 'Savings', is_default: true },
  { name: 'Aktier/Fonder', cost_type: 'Savings', subcategory: 'Savings', is_default: true },
  { name: 'Övrigt sparande', cost_type: 'Savings', subcategory: 'Savings', is_default: true },
]

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    const userId = claimsData?.claims?.sub
    if (claimsError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const email = typeof claimsData?.claims?.email === 'string' ? claimsData.claims.email : ''

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const firstName = typeof payload.firstName === 'string' ? payload.firstName.trim().slice(0, 80) : ''
    const lastName = typeof payload.lastName === 'string' ? payload.lastName.trim().slice(0, 80) : undefined
    const salaryDayRaw = Number(payload.salaryDay)
    const salaryDay = Number.isInteger(salaryDayRaw) && salaryDayRaw >= 1 && salaryDayRaw <= 31 ? salaryDayRaw : undefined
    const onboardingCompleted = typeof payload.onboardingCompleted === 'boolean' ? payload.onboardingCompleted : undefined
    const enabledModules: OptionalModule[] | undefined = Array.isArray(payload.enabledModules)
      ? payload.enabledModules.filter(isOptionalModule)
      : undefined

    // The generated types lag the live schema (new profile columns, category columns).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceClient() as any

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (!existingProfile) {
      const { error: profileError } = await admin.from('profiles').insert({
        id: userId,
        email,
        first_name: firstName || 'Användare',
        last_name: lastName ?? '',
        salary_day: salaryDay ?? 25,
        onboarding_completed: onboardingCompleted ?? false,
        currency: 'SEK',
        language: 'sv',
        theme: 'light',
        ccm_enabled: enabledModules?.includes('ccm') ?? false,
        ccm_invoice_break_date: 1,
        // New users start with only the modules they pick (none until onboarding).
        enabled_modules: enabledModules ?? [],
        seen_intros: [],
      })
      if (profileError) {
        console.error('Setup: profile insert failed', profileError)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }
    } else {
      const updateData: Record<string, unknown> = {}
      if (firstName) updateData.first_name = firstName
      if (lastName !== undefined) updateData.last_name = lastName
      if (salaryDay !== undefined) updateData.salary_day = salaryDay
      if (onboardingCompleted !== undefined) updateData.onboarding_completed = onboardingCompleted
      if (enabledModules !== undefined) {
        updateData.enabled_modules = enabledModules
        updateData.ccm_enabled = enabledModules.includes('ccm')
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await admin.from('profiles').update(updateData).eq('id', userId)
        if (updateError) {
          console.error('Setup: profile update failed', updateError)
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
      }
    }

    const { data: existingCategories } = await admin
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    const categoriesCreated = !existingCategories || existingCategories.length === 0
    if (categoriesCreated) {
      const { error: catError } = await admin
        .from('categories')
        .insert(DEFAULT_CATEGORIES.map((cat) => ({ ...cat, user_id: userId })))
      if (catError) {
        console.error('Setup: category seed failed', catError)
        return NextResponse.json({ error: 'Failed to create categories' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, categoriesCreated })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
