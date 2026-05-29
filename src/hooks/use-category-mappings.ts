'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CategoryMapping {
  id: string
  pattern: string
  category_id: string | null
  cost_assignment: 'personal' | 'shared' | 'partner' | null
  match_type: 'contains' | 'starts_with' | 'exact'
  bank: string | null
  priority: number
  comment: string | null
  hit_count: number
  last_used_at: string | null
  category?: { id: string; name: string; cost_type: string } | null
}

export interface MatchedMapping extends CategoryMapping {
  matched_pattern_length: number
}

/**
 * Fetches all mappings for the current user, sorted by priority then pattern length.
 */
export function useCategoryMappings() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['category-mappings'],
    queryFn: async (): Promise<CategoryMapping[]> => {
      const { data, error } = await supabase
        .from('category_mappings')
        .select('*, category:categories(id, name, cost_type)')
        .order('priority', { ascending: false })

      if (error) throw error
      return (data as CategoryMapping[]) || []
    },
  })
}

/**
 * Pure function — finds the best matching mapping for a transaction description.
 *
 * Algorithm:
 * 1. Filter mappings by match_type (contains, starts_with, exact)
 * 2. Optionally filter by bank
 * 3. Sort by priority desc, then pattern length desc
 * 4. Return first match
 *
 * Longest-match-wins ensures "ICA MAXI" beats "ICA".
 */
export function findMatchingMapping(
  description: string,
  mappings: CategoryMapping[],
  bank?: string | null
): MatchedMapping | null {
  if (!description) return null
  const desc = description.toLowerCase()

  const candidates: MatchedMapping[] = []

  for (const m of mappings) {
    // Bank filter
    if (m.bank && bank && m.bank.toLowerCase() !== bank.toLowerCase()) continue

    const pattern = m.pattern.toLowerCase()
    let matches = false

    switch (m.match_type) {
      case 'exact':
        matches = desc === pattern
        break
      case 'starts_with':
        matches = desc.startsWith(pattern)
        break
      case 'contains':
      default:
        matches = desc.includes(pattern)
        break
    }

    if (matches) {
      candidates.push({ ...m, matched_pattern_length: m.pattern.length })
    }
  }

  if (candidates.length === 0) return null

  // Sort: priority desc, then pattern length desc
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return b.matched_pattern_length - a.matched_pattern_length
  })

  return candidates[0]
}

/**
 * Increments hit_count for a mapping when it's used.
 * Fire-and-forget — don't await this in hot paths.
 */
export async function incrementMappingHit(mappingId: string): Promise<void> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc('increment_mapping_hit', { p_mapping_id: mappingId })
}

/**
 * Create a new mapping. Called when user categorizes an unmapped transaction
 * and chooses to "save as rule".
 */
export function useCreateMapping() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (mapping: {
      pattern: string
      category_id: string
      cost_assignment?: 'personal' | 'shared' | 'partner' | null
      match_type?: 'contains' | 'starts_with' | 'exact'
      bank?: string | null
      priority?: number
      comment?: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('category_mappings') as any)
        .insert({
          user_id: user.id,
          pattern: mapping.pattern,
          category_id: mapping.category_id,
          cost_assignment: mapping.cost_assignment ?? null,
          match_type: mapping.match_type ?? 'contains',
          bank: mapping.bank ?? null,
          priority: mapping.priority ?? 50,
          comment: mapping.comment ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-mappings'] })
    },
  })
}

/**
 * Update an existing mapping (e.g. when user changes a category and wants
 * future transactions to use the new category).
 */
export function useUpdateMapping() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CategoryMapping> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('category_mappings') as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-mappings'] })
    },
  })
}

export function useDeleteMapping() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('category_mappings').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-mappings'] })
    },
  })
}

/**
 * Suggest a pattern based on a transaction description.
 * Strips location info, trailing numbers, dates etc. to get a stable identifier.
 *
 * Examples:
 *   "ICA MAXI SOLNA 2026-05-22" → "ICA MAXI"
 *   "APOTEK HJÄRTAT STOCKHOLM C" → "APOTEK HJÄRTAT"
 *   "SPOTIFY*PREMIUM" → "SPOTIFY"
 */
export function suggestPatternFromDescription(description: string): string {
  let s = description.trim().toUpperCase()

  // Strip dates
  s = s.replace(/\d{4}-\d{2}-\d{2}/g, '')
  s = s.replace(/\d{2}\/\d{2}\/\d{4}/g, '')
  // Strip trailing numbers (transaction IDs, store numbers)
  s = s.replace(/\s+\d{4,}\s*$/, '')
  // Strip "Klarna*" prefix etc.
  s = s.replace(/^[A-Z]+\*/, '')
  // Strip card transaction prefix "K*" or "KORTKÖP "
  s = s.replace(/^(K\*|KORTKÖP\s+|KÖP\s+)/, '')
  // Common Swedish city/region suffixes
  const cities = [
    'STOCKHOLM', 'GÖTEBORG', 'MALMÖ', 'UPPSALA', 'SOLNA', 'TÄBY', 'SUNDBYBERG',
    'LIDINGÖ', 'NACKA', 'HUDDINGE', 'BROMMA', 'KISTA', 'VASASTAN', 'SÖDERMALM',
    'NORRMALM', 'ÖSTERMALM', 'BARKARBY', 'JÄRFÄLLA', 'LUDVIKA', 'CENTRALSTATION',
  ]
  for (const city of cities) {
    s = s.replace(new RegExp('\\s+' + city + '\\s*$', 'i'), '')
    s = s.replace(new RegExp('\\s+' + city + '\\s*\\d.*$', 'i'), '')
  }

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim()

  // Take first 2-3 significant words for a stable pattern
  const words = s.split(' ').filter(w => w.length > 1)
  if (words.length >= 2) return words.slice(0, 2).join(' ')
  return words[0] || s
}
