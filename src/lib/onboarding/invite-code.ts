// Partner invite codes: 6 characters, no look-alikes (0/O, 1/I/L), from the
// browser's crypto RNG. The RLS insert policy allows at most one day.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const INVITE_TTL_MS = 24 * 60 * 60 * 1000

export function generateInviteCode(length = 6): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}
