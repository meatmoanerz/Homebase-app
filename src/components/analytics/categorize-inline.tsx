'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { CategoryCombobox } from '@/components/import/category-combobox'
import { useCategories } from '@/hooks/use-categories'
import { useUpdateExpense } from '@/hooks/use-expenses'
import { useCreateMapping, suggestPatternFromDescription } from '@/hooks/use-category-mappings'
import type { ExpenseWithCategory } from '@/types'

/**
 * Category picker for an uncategorised expense. Choosing a category saves it
 * and learns a category rule from the description, so the same merchant is
 * categorised automatically on the next import.
 */
export function CategorizeInline({ expense }: { expense: ExpenseWithCategory }) {
  const { data: categories = [] } = useCategories()
  const updateExpense = useUpdateExpense()
  const createMapping = useCreateMapping()
  const [saving, setSaving] = useState(false)

  const handleChange = async (categoryId: string | null) => {
    if (!categoryId || saving) return
    setSaving(true)
    try {
      await updateExpense.mutateAsync({ id: expense.id, category_id: categoryId })
    } catch {
      toast.error('Kunde inte spara kategorin')
      setSaving(false)
      return
    }
    const pattern = suggestPatternFromDescription(expense.description)
    try {
      if (pattern.length >= 3) {
        await createMapping.mutateAsync({
          pattern,
          category_id: categoryId,
          cost_assignment: expense.cost_assignment,
          match_type: 'contains',
          bank: expense.bank,
          priority: 50,
          comment: `Skapad från Analys för "${expense.description}"`,
        })
        toast.success(`Kategoriserad · regel "${pattern}" sparad för kommande importer`)
      } else {
        toast.success('Kategoriserad')
      }
    } catch {
      // The rule may already exist; the expense itself is saved.
      toast.success('Kategoriserad (regeln fanns redan eller kunde inte sparas)')
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-2 px-3 pb-2.5 -mt-1">
      <Sparkles className="w-3.5 h-3.5 text-hb-cognac shrink-0" aria-hidden="true" />
      <CategoryCombobox
        value={null}
        categories={categories}
        onChange={handleChange}
        placeholder={saving ? 'Sparar…' : 'Välj kategori och lär regel'}
        className="flex-1"
      />
    </div>
  )
}
