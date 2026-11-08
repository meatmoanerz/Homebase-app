'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useDeleteListItems, useToggleListItems } from '@/hooks/use-shopping'
import { groupBySection } from '@/lib/shopping/sections'
import { cn } from '@/lib/utils/cn'
import type { ShoppingListItem } from '@/types/meals'

/** An own list: check off together in real time, remove rows. */
export function ShoppingItemsList({ listId, items }: { listId: string; items: ShoppingListItem[] }) {
  const toggle = useToggleListItems(listId)
  const remove = useDeleteListItems(listId)
  const sections = useMemo(() => groupBySection(items), [items])
  const checkedIds = items.filter((i) => i.checked).map((i) => i.id)

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="rounded-full bg-hb-sage/20 px-2.5 py-1 text-[12px] font-medium tabular-nums">
          {checkedIds.length} av {items.length} i korgen
        </span>
        {checkedIds.length > 0 && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggle.mutate({ ids: checkedIds, checked: false })}
              disabled={toggle.isPending}
            >
              Avmarkera alla
            </Button>
            <Button variant="ghost" size="sm" onClick={() => remove.mutate(checkedIds)} disabled={remove.isPending}>
              Ta bort avbockade
            </Button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        {sections.map(([section, rows], idx) => (
          <div key={section} className={cn('py-1', idx > 0 && 'border-t border-border')}>
            <h3 className="label-caps text-muted-foreground px-4 pt-3 pb-1">{section}</h3>
            <ul>
              {rows.map((item) => {
                const id = `item-${item.id}`
                return (
                  <li key={item.id} className="flex items-center hover:bg-secondary/40">
                    <label htmlFor={id} className="flex flex-1 min-w-0 items-start gap-3 pl-4 py-2 cursor-pointer">
                      <Checkbox
                        id={id}
                        checked={item.checked}
                        onCheckedChange={(value) => toggle.mutate({ ids: [item.id], checked: value === true })}
                        className="h-5 w-5 mt-0.5"
                      />
                      <span className="flex-1 min-w-0">
                        <span className={cn('block text-[14px] font-medium', item.checked && 'line-through text-muted-foreground')}>
                          {item.name}
                        </span>
                        {item.qty_text && <span className="block text-[12px] text-muted-foreground">{item.qty_text}</span>}
                      </span>
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 mr-1 shrink-0 text-muted-foreground"
                      aria-label={`Ta bort ${item.name}`}
                      onClick={() => remove.mutate([item.id])}
                      disabled={remove.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
