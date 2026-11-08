'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SHOPPING_SECTIONS } from '@/lib/shopping/sections'
import { cn } from '@/lib/utils/cn'

/** Store section picker; a section not in the list (from Veckomat) is kept as an option. */
export function SectionSelect({
  value,
  onChange,
  className,
  label = 'Avdelning',
}: {
  value: string
  onChange: (section: string) => void
  className?: string
  label?: string
}) {
  const options: string[] = (SHOPPING_SECTIONS as readonly string[]).includes(value)
    ? [...SHOPPING_SECTIONS]
    : [...SHOPPING_SECTIONS, value]

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn('h-11 w-[8rem] shrink-0 px-2.5 text-[13px] [&>span]:truncate', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((section) => (
          <SelectItem key={section} value={section}>
            {section}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
