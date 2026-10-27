/**
 * Format a number as Swedish currency
 */
export function formatCurrency(amount: number, currency: string = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format a unit price: öre below 20 kr ("3,17 kr" per egg), whole kronor above.
 */
export function formatPrice(amount: number): string {
  const decimals = Math.abs(amount) < 20 ? 2 : 0
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

/**
 * Format a number with Swedish locale
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${formatNumber(value, decimals)}%`
}

/**
 * Format a compact number (e.g., 1.2k, 1.5M)
 */
export function formatCompact(num: number): string {
  return new Intl.NumberFormat('sv-SE', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num)
}

/**
 * Parse a Swedish formatted number string to number
 */
export function parseSwedishNumber(str: string): number {
  // Remove spaces and replace comma with dot
  const cleaned = str.replace(/\s/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

/**
 * Format date in Swedish locale
 */
export function formatDate(date: Date | string, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'string' ? new Date(date) : date

  const optionsMap: Record<'short' | 'medium' | 'long', Intl.DateTimeFormatOptions> = {
    short: { day: 'numeric', month: 'numeric' },
    medium: { day: 'numeric', month: 'short' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
  }

  return d.toLocaleDateString('sv-SE', optionsMap[style])
}

/**
 * Format relative date (today, yesterday, etc.)
 */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (d.toDateString() === today.toDateString()) {
    return 'Idag'
  } else if (d.toDateString() === yesterday.toDateString()) {
    return 'Igår'
  } else {
    return formatDate(d, 'medium')
  }
}

/**
 * Get initials from name
 */
export function getInitials(firstName: string, lastName?: string): string {
  const first = firstName.charAt(0).toUpperCase()
  const last = lastName?.charAt(0).toUpperCase() || ''
  return first + last
}

