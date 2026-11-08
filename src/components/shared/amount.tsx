import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

interface AmountProps {
  value: number
  /** Text before the number, e.g. "~" or "+". */
  prefix?: string
  className?: string
}

/**
 * A money amount: digits in mono with tabular figures, "kr" small, muted and
 * in sans. In a monospace face the unit is as wide as a digit, so at full size
 * it competes with the number itself.
 */
export function Amount({ value, prefix = '', className }: AmountProps) {
  const digits = formatCurrency(value).replace(/\s?kr$/, '')
  return (
    <span className={cn('font-mono tabular-nums tracking-[-0.04em]', className)}>
      {prefix}
      {digits}
      <span className="ml-[0.2em] font-sans text-[max(0.62em,11px)] font-normal tracking-normal opacity-60">kr</span>
    </span>
  )
}
