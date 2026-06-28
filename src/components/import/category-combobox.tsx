'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface CategoryOption {
  id: string
  name: string
}

interface CategoryComboboxProps {
  value: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[]
  onChange: (categoryId: string | null) => void
  placeholder?: string
  className?: string
  error?: boolean
}

/**
 * Searchable category picker. Replaces the native <select> in the import flow
 * so long category lists can be filtered by typing.
 */
export function CategoryCombobox({
  value,
  categories,
  onChange,
  placeholder = '— ingen kategori —',
  className,
  error,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const options: CategoryOption[] = categories.map((c) => ({ id: c.id, name: c.name }))
  const selected = options.find((o) => o.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, query])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Focus the search field when opening
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function select(id: string | null) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1 text-[11px] bg-secondary border border-border rounded-full px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-hb-cognac max-w-[160px]',
          error && 'border-hb-amber/50',
          !selected && 'text-muted-foreground'
        )}
      >
        <span className="truncate">{selected ? selected.name : placeholder}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-56 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök kategori…"
              className="w-full bg-transparent text-xs focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => select(null)}
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary flex items-center justify-between"
            >
              {placeholder}
              {!value && <Check className="w-3.5 h-3.5" />}
            </button>
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Ingen träff</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => select(o.id)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary flex items-center justify-between"
              >
                <span className="truncate">{o.name}</span>
                {value === o.id && <Check className="w-3.5 h-3.5 text-hb-cognac flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
