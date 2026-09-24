'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

export interface StagingBatch {
  batch_id: string
  source: string | null
  opened_at: string | null
  uploaded_at: string
  expires_at: string
  pinned: boolean
  bank: string | null
  row_count: number
  selected_count: number
  total_amount: number
}

export interface StagingRow {
  id: number
  batch_id: string
  uploaded_at: string
  expires_at: string
  pinned: boolean
  bank: string | null
  cardholder: string | null
  date: string
  description: string
  amount: number
  category_id: string | null
  cost_assignment: 'personal' | 'shared' | 'partner'
  is_ccm: boolean
  match_source: string
  dup_existing: boolean
  selected: boolean
  status: string
  is_group_purchase: boolean
  group_purchase_user_share: number | null
  group_purchase_partner_share: number | null
  group_purchase_swish_recipient: 'user' | 'partner' | 'shared' | null
  amex_sync_transaction_id: string | null
}

export function useImportBatches() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['import-staging', 'batches'],
    queryFn: async (): Promise<StagingBatch[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('import_staging') as any)
        .select('batch_id, uploaded_at, expires_at, pinned, bank, amount, selected')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) return []

      const batchIds = [...new Set(data.map((row: { batch_id: string }) => row.batch_id))]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: metadata, error: metadataError } = await (supabase.from('import_batches') as any)
        .select('id, source, opened_at')
        .in('id', batchIds)
      if (metadataError) throw metadataError
      const metadataById = new Map(
        ((metadata || []) as Array<{ id: string; source: string; opened_at: string | null }>)
          .map((batch) => [batch.id, batch])
      )

      // Group by batch_id
      const batchMap = new Map<string, StagingBatch>()
      for (const row of data as Array<{
        batch_id: string; uploaded_at: string; expires_at: string
        pinned: boolean; bank: string | null; amount: number; selected: boolean
      }>) {
        const existing = batchMap.get(row.batch_id)
        if (existing) {
          existing.row_count++
          existing.total_amount += Number(row.amount)
          if (row.selected) existing.selected_count++
        } else {
          const batchMetadata = metadataById.get(row.batch_id)
          batchMap.set(row.batch_id, {
            batch_id: row.batch_id,
            source: batchMetadata?.source ?? null,
            opened_at: batchMetadata?.opened_at ?? null,
            uploaded_at: row.uploaded_at,
            expires_at: row.expires_at,
            pinned: row.pinned,
            bank: row.bank,
            row_count: 1,
            selected_count: row.selected ? 1 : 0,
            total_amount: Number(row.amount),
          })
        }
      }

      return Array.from(batchMap.values()).sort(
        (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      )
    },
    staleTime: 30_000,
  })
}

export function useStagingRows(batchId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['import-staging', 'rows', batchId],
    queryFn: async (): Promise<StagingRow[]> => {
      if (!batchId) return []
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('import_staging') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('batch_id', batchId)
        .eq('status', 'pending')
        .order('date', { ascending: false })

      if (error) throw error
      return (data as StagingRow[]) || []
    },
    enabled: !!batchId,
    staleTime: 30_000,
  })
}

export function useUpdateStagingRow() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id, updates,
    }: {
      id: number
      updates: Partial<Pick<StagingRow, 'category_id' | 'cost_assignment' | 'selected' | 'pinned'>>
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('import_staging') as any)
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-staging'] })
    },
  })
}

export function useToggleBatchPin() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ batchId, pinned }: { batchId: string; pinned: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('import_staging') as any)
        .update({ pinned })
        .eq('batch_id', batchId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-staging'] })
    },
  })
}

export function useMarkBatchOpened() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (batchId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('import_batches') as any)
        .update({ opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', batchId)
        .is('opened_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-staging'] })
    },
  })
}

export function useDeleteBatch() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (batchId: string) => {
      // Deleting batch metadata first releases staged Amex rows back to the
      // durable inbox via the database trigger. Legacy/manual batches have no
      // metadata row, so this remains a no-op for them.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: batchError } = await (supabase.from('import_batches') as any)
        .delete()
        .eq('id', batchId)
      if (batchError) throw batchError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('import_staging') as any)
        .delete()
        .eq('batch_id', batchId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-staging'] })
    },
  })
}

export function useCompleteAmexBatch() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ batchId, rows }: { batchId: string; rows: StagingRow[] }): Promise<number> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('complete_amex_review_batch', {
        p_batch_id: batchId,
        p_edits: rows.map((row) => ({
          id: row.id, category_id: row.category_id, cost_assignment: row.cost_assignment,
          selected: row.selected, is_group_purchase: row.is_group_purchase,
          group_purchase_user_share: row.group_purchase_user_share,
          group_purchase_partner_share: row.group_purchase_partner_share,
          group_purchase_swish_recipient: row.group_purchase_swish_recipient,
        })),
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      for (const key of ['import-staging', 'expenses', 'dashboard', 'ccm-invoices', 'savings-goals', 'savings-goal-contributions']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
  })
}

// Unused export kept to avoid unused-import warning on formatDistanceToNow
export { formatDistanceToNow }
