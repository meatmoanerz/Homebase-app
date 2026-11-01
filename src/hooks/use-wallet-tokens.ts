'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface WalletToken {
  id: string
  cardholder: string
  created_at: string
  last_used_at: string | null
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((data as { error?: string }).error || 'Något gick fel')
  return data as T
}

/** The signed-in user's active shortcut keys (never the keys themselves). */
export function useWalletTokens() {
  return useQuery({
    queryKey: ['wallet-tokens'],
    queryFn: async () => {
      const data = await readJson<{ tokens: WalletToken[] }>(await fetch('/api/wallet-tokens'))
      return data.tokens
    },
  })
}

export function useCreateWalletToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (label: string) =>
      readJson<{ token: string; entry: WalletToken }>(
        await fetch('/api/wallet-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label }),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-tokens'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Kunde inte skapa nyckeln')
    },
  })
}

export function useRevokeWalletToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      readJson<{ ok: true }>(await fetch(`/api/wallet-tokens?id=${encodeURIComponent(id)}`, { method: 'DELETE' })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-tokens'] })
      toast.success('Nyckeln är borttagen. Genvägar som använder den slutar fungera.')
    },
    onError: () => {
      toast.error('Kunde inte ta bort nyckeln')
    },
  })
}
