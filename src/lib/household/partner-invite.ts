import type { createClient } from '@/lib/supabase/client'

type BrowserClient = ReturnType<typeof createClient>

// The generated Database types don't describe these functions, so the call
// goes through a narrow signature instead of `any`.
type RpcCall = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>

function rpc(supabase: BrowserClient): RpcCall {
  return supabase.rpc.bind(supabase) as unknown as RpcCall
}

/**
 * Partner invites go through two database functions. Both act on the signed-in
 * user (auth.uid()); the client never says who it is. A user can have one
 * pending invite and one active partner at a time.
 */

type InviteResult =
  | { success: true; invite_code: string; expires_at: string }
  | { success: false; error: string }

type JoinResult =
  | { success: true; connection_id: string; partner_id: string }
  | { success: false; error: string }

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_code: 'Ogiltig eller utgången kod',
  cannot_join_own_invite: 'Du kan inte gå med i din egen inbjudan',
  already_connected: 'Du är redan kopplad till en partner. Koppla från först.',
  inviter_already_connected: 'Den som bjöd in dig är redan kopplad till någon annan',
  not_authenticated: 'Du är inte inloggad. Logga in och försök igen.',
}

export function partnerErrorMessage(code: string | undefined): string {
  return (code && ERROR_MESSAGES[code]) || 'Något gick fel. Försök igen.'
}

/** Creates (or replaces) the user's invite code. Valid for one hour. */
export async function createPartnerInvite(supabase: BrowserClient): Promise<InviteResult> {
  const { data, error } = await rpc(supabase)('create_partner_invite')
  if (error || !data) return { success: false, error: 'rpc_error' }
  return data as InviteResult
}

/** Connects the signed-in user to whoever created the invite code. */
export async function joinPartner(supabase: BrowserClient, inviteCode: string): Promise<JoinResult> {
  const { data, error } = await rpc(supabase)('join_partner_connection', {
    p_invite_code: inviteCode.toUpperCase().trim(),
  })
  if (error || !data) return { success: false, error: 'rpc_error' }
  return data as JoinResult
}
