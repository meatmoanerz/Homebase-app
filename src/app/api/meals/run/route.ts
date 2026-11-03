import { NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { MEAL_RUN_MODEL, MealRunError, runMealPlan } from '@/lib/meals/run-plan'

export const runtime = 'nodejs'
// Fetching offers and letting Claude plan the week takes a few minutes.
export const maxDuration = 300

const MAX_RUNS_PER_WEEK = 6
// A run still "running" after this was cut off (function timeout).
const STALE_AFTER_MS = 6 * 60 * 1000

// POST /api/meals/run — start a Veckomat run for the signed-in user. Answers
// right away with the run id; the work continues after the response and the
// app follows meal_runs.status.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Inte inloggad' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- functions not in generated types yet
  const db = supabase as any
  const { data: hasAccess } = await db.rpc('has_feature_access', { p_feature: 'meals' })
  if (hasAccess !== true) return NextResponse.json({ ok: false, error: 'Veckomat är inte öppet för ditt konto' }, { status: 403 })

  const { data: context, error: ctxError } = await db.rpc('meal_prompt_context')
  if (ctxError || !context) {
    return NextResponse.json({ ok: false, error: 'Ställ in hushållet under Inställningar först' }, { status: 400 })
  }
  const { year, iso_week } = context as { year: number; iso_week: number }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- meal tables not in generated types yet
  const admin = createServiceClient() as any
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await admin
    .from('meal_runs')
    .select('id, status, created_at')
    .eq('user_id', user.id)
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: false })
  const runs = (recent ?? []) as { id: string; status: string; created_at: string }[]

  const stale = runs.filter((r) => r.status === 'running' && Date.now() - new Date(r.created_at).getTime() > STALE_AFTER_MS)
  if (stale.length > 0) {
    await admin
      .from('meal_runs')
      .update({ status: 'failed', error: 'Körningen hann inte bli klar', finished_at: new Date().toISOString() })
      .in('id', stale.map((r) => r.id))
  }
  const running = runs.find((r) => r.status === 'running' && !stale.includes(r))
  if (running) return NextResponse.json({ ok: true, runId: running.id, alreadyRunning: true })
  if (runs.length >= MAX_RUNS_PER_WEEK) {
    return NextResponse.json({ ok: false, error: `Max ${MAX_RUNS_PER_WEEK} körningar per vecka` }, { status: 429 })
  }

  const { data: run, error: insertError } = await admin
    .from('meal_runs')
    .insert({ user_id: user.id, year, iso_week, model: MEAL_RUN_MODEL })
    .select('id')
    .single()
  if (insertError || !run) return NextResponse.json({ ok: false, error: 'Kunde inte starta körningen' }, { status: 500 })

  after(async () => {
    try {
      const result = await runMealPlan(admin, user.id)
      await admin
        .from('meal_runs')
        .update({
          status: 'done',
          meal_plan_id: result.mealPlanId,
          sources: result.sources,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          finished_at: new Date().toISOString(),
        })
        .eq('id', run.id)
    } catch (error) {
      const message = error instanceof MealRunError ? error.message : 'Något gick fel när matsedeln skulle tas fram'
      if (!(error instanceof MealRunError)) console.error('Meal run failed:', error)
      await admin
        .from('meal_runs')
        .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
        .eq('id', run.id)
    }
  })

  return NextResponse.json({ ok: true, runId: run.id })
}
