// Inköpslista: egna listor och utkastet. Speglar
// supabase/migrations/20261108120000_shopping_lists.sql — de genererade
// databastyperna har inte de här tabellerna än.

import type { ShoppingListItem } from '@/types/meals'

/** A row in the draft on the shopping page (shopping_list_drafts.items). */
export interface DraftItem {
  id: string
  name: string
  qty_text: string | null
  section: string
  /** The section was picked by hand: remembered for next time on save. */
  manual: boolean
}

export interface ShoppingListSummary {
  id: string
  user_id: string
  name: string
  created_at: string
  archived_at: string | null
  items: { checked: boolean }[]
}

export interface ShoppingListDetail extends Omit<ShoppingListSummary, 'items'> {
  items: ShoppingListItem[]
}

/** Where the draft can be saved: a Veckomat plan or an own list. */
export type SaveTarget =
  | { kind: 'meal_plan'; id: string }
  | { kind: 'list'; id: string }
  | { kind: 'new'; name: string }
