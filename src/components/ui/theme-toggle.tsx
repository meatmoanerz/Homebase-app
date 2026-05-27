'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const themes = [
  { value: 'light', label: 'Ljust', icon: Sun },
  { value: 'dark', label: 'Mörkt', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex gap-1 p-1 bg-hb-sage/20 rounded-lg">
        {themes.map((t) => (
          <div
            key={t.value}
            className="flex items-center gap-2 px-3 py-2 rounded-md"
          >
            <t.icon className="w-4 h-4" />
            <span className="text-sm">{t.label}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="flex gap-1 p-1 bg-hb-sage/20 rounded-lg"
      role="radiogroup"
      aria-label="Välj tema"
    >
      {themes.map((t) => {
        const isActive = theme === t.value
        const Icon = t.icon

        return (
          <button
            key={t.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(t.value)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200',
              isActive
                ? 'bg-white dark:bg-card text-hb-cognac shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span className="text-sm font-medium">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ThemeToggleCompact() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg bg-hb-sage/20"
        aria-label="Byt tema"
      >
        <Sun className="w-5 h-5" />
      </button>
    )
  }

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const Icon = resolvedTheme === 'dark' ? Moon : Sun
  const label =
    theme === 'system'
      ? 'System (klicka för ljust)'
      : theme === 'dark'
        ? 'Mörkt (klicka för system)'
        : 'Ljust (klicka för mörkt)'

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg bg-hb-sage/20 hover:bg-hb-sage/30 transition-colors"
      aria-label={label}
    >
      <Icon className="w-5 h-5 text-hb-cognac" aria-hidden="true" />
    </button>
  )
}
