import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

// Service role (bypasses RLS). Only ever used with the id of the verified
// session user below.
function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * The signed-in user, verified with Supabase Auth. The user id is never
 * taken from the request: this route writes with the service role, so a
 * client-supplied id would let anyone change anyone's profile.
 */
async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

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
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id
    const supabaseAdmin = createServiceClient()

    const { firstName, lastName, salaryDay, onboardingCompleted } = await request.json() as {
      firstName?: string
      lastName?: string
      salaryDay?: string | number
      onboardingCompleted?: boolean
    }
    const parsedSalaryDay = salaryDay ? parseInt(String(salaryDay), 10) : NaN
    const validSalaryDay = parsedSalaryDay >= 1 && parsedSalaryDay <= 31 ? parsedSalaryDay : null

    // 1. Check if profile exists
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to read profile' }, { status: 500 })
    }

    // 2. Create or update profile
    if (!existingProfile) {
      const { data: newProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          email: user.email || '',
          first_name: firstName || 'User',
          last_name: lastName || '',
          salary_day: validSalaryDay ?? 25,
          onboarding_completed: onboardingCompleted ?? false,
          currency: 'SEK',
          language: 'sv',
          theme: 'light',
          ccm_enabled: false,
          ccm_invoice_break_date: 1,
        })
        .select()
        .single()

      if (profileError || !newProfile) {
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }
    } else {
      // Update existing profile
      const updateData: ProfileUpdate = {}
      if (firstName) updateData.first_name = firstName
      if (lastName !== undefined) updateData.last_name = lastName
      if (validSalaryDay) updateData.salary_day = validSalaryDay
      if (onboardingCompleted !== undefined) updateData.onboarding_completed = onboardingCompleted

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update(updateData)
          .eq('id', userId)

        if (updateError) {
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
      }
    }

    // 3. Check if categories exist
    const { data: existingCategories, error: catCheckError } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (catCheckError) {
      return NextResponse.json({ error: 'Failed to read categories' }, { status: 500 })
    }

    // 4. Create categories if they don't exist
    if (!existingCategories || existingCategories.length === 0) {
      const categoriesWithUserId = DEFAULT_CATEGORIES.map(cat => ({
        ...cat,
        user_id: userId,
      }))

      const { error: catError } = await supabaseAdmin
        .from('categories')
        .insert(categoriesWithUserId)

      if (catError) {
        return NextResponse.json({ error: 'Failed to create categories' }, { status: 500 })
      }
    }

    // 5. Clean up duplicate incomes (keep the first one)
    const { data: allIncomes } = await supabaseAdmin
      .from('incomes')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (allIncomes && allIncomes.length > 1) {
      // Group by name and find duplicates
      const seen = new Set<string>()
      const duplicateIds: string[] = []
      
      for (const income of allIncomes) {
        if (seen.has(income.name)) {
          duplicateIds.push(income.id)
        } else {
          seen.add(income.name)
        }
      }

      if (duplicateIds.length > 0) {
        await supabaseAdmin
          .from('incomes')
          .delete()
          .in('id', duplicateIds)
        
        console.log('Cleaned up duplicate incomes:', duplicateIds.length)
      }
    }

    const duplicatesRemoved = allIncomes && allIncomes.length > 0
      ? allIncomes.length - new Set(allIncomes.map(i => i.name)).size
      : 0

    return NextResponse.json({ 
      success: true, 
      message: 'User setup complete',
      categoriesCreated: !existingCategories || existingCategories.length === 0,
      duplicatesRemoved,
      onboarding_completed: onboardingCompleted ?? false
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET route to check the signed-in user's onboarding status
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await createServiceClient()
      .from('profiles')
      .select('onboarding_completed, first_name, last_name, salary_day')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({ 
      onboarding_completed: profile?.onboarding_completed ?? false,
      profile: profile
    })

  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
