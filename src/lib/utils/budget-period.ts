import { format, addMonths, subMonths, isAfter, isBefore, startOfDay, getDay } from 'date-fns'
import { sv } from 'date-fns/locale'
import type { BudgetPeriod } from '@/types'

/**
 * Adjust a salary day to the nearest preceding weekday if it falls on a weekend.
 * Saturday (6) → Friday, Sunday (0) → Friday.
 */
export function getAdjustedSalaryDate(year: number, month: number, salaryDay: number): Date {
  // month is 0-indexed here (JS Date convention)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const clampedDay = Math.min(salaryDay, daysInMonth)
  const date = new Date(year, month, clampedDay)
  const dayOfWeek = getDay(date)

  if (dayOfWeek === 6) {
    // Saturday → Friday (subtract 1 day)
    date.setDate(date.getDate() - 1)
  } else if (dayOfWeek === 0) {
    // Sunday → Friday (subtract 2 days)
    date.setDate(date.getDate() - 2)
  }

  return startOfDay(date)
}

/**
 * Get the budget period for a given date based on salary day
 * If salary day is 25th, "May Budget" runs from April 25 to May 24
 * Weekend adjustment: if the salary day falls on a weekend, it moves to the preceding Friday.
 */
export function getBudgetPeriod(date: Date, salaryDay: number): BudgetPeriod {
  const today = startOfDay(date)

  // Get adjusted salary date for this month and previous month
  const adjustedThisMonth = getAdjustedSalaryDate(today.getFullYear(), today.getMonth(), salaryDay)

  let periodMonth: Date

  if (today >= adjustedThisMonth) {
    // We're in the current month's budget period
    periodMonth = today
  } else {
    // We're still in last month's budget period
    periodMonth = subMonths(today, 1)
  }

  // Calculate actual start/end dates with weekend adjustment
  const startDate = getAdjustedSalaryDate(periodMonth.getFullYear(), periodMonth.getMonth(), salaryDay)
  const nextMonth = addMonths(periodMonth, 1)
  const endAdjusted = getAdjustedSalaryDate(nextMonth.getFullYear(), nextMonth.getMonth(), salaryDay)
  const endDate = new Date(endAdjusted)
  endDate.setDate(endDate.getDate() - 1)

  return {
    period: format(addMonths(periodMonth, 1), 'yyyy-MM'),
    startDate,
    endDate,
    displayName: format(addMonths(periodMonth, 1), 'MMMM yyyy', { locale: sv }),
  }
}

/**
 * Get the current budget period based on salary day
 */
export function getCurrentBudgetPeriod(salaryDay: number): BudgetPeriod {
  return getBudgetPeriod(new Date(), salaryDay)
}

/**
 * Get the previous budget period
 */
export function getPreviousBudgetPeriod(salaryDay: number): BudgetPeriod {
  return getBudgetPeriod(subMonths(new Date(), 1), salaryDay)
}

/**
 * Get the next budget period
 */
export function getNextBudgetPeriod(salaryDay: number): BudgetPeriod {
  return getBudgetPeriod(addMonths(new Date(), 1), salaryDay)
}

/**
 * Check if a date is within a budget period
 */
export function isDateInPeriod(date: Date, period: BudgetPeriod): boolean {
  const day = startOfDay(date)
  return !isBefore(day, period.startDate) && !isAfter(day, period.endDate)
}

/**
 * Get days remaining until next salary (with weekend adjustment)
 */
export function getDaysUntilSalary(salaryDay: number): number {
  const today = startOfDay(new Date())

  // Get the adjusted salary date for this month
  const adjustedThisMonth = getAdjustedSalaryDate(today.getFullYear(), today.getMonth(), salaryDay)

  if (today < adjustedThisMonth) {
    // Salary day is still coming this month
    const diffTime = adjustedThisMonth.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  } else if (today.getTime() === adjustedThisMonth.getTime()) {
    // Today is salary day!
    return 0
  } else {
    // Salary day has passed, calculate days until next month's adjusted salary day
    const nextMonthDate = addMonths(today, 1)
    const adjustedNextMonth = getAdjustedSalaryDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), salaryDay)
    const diffTime = adjustedNextMonth.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }
}

/**
 * Get progress through current budget period (0-100)
 */
export function getPeriodProgress(salaryDay: number): number {
  const period = getCurrentBudgetPeriod(salaryDay)
  const today = new Date()
  const totalDays = Math.ceil((period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysPassed = Math.ceil((today.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  return Math.min(100, Math.max(0, (daysPassed / totalDays) * 100))
}

/**
 * Format a period string (YYYY-MM) to display name
 */
export function formatPeriodDisplay(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(year, month - 1)
  return format(date, 'MMMM yyyy', { locale: sv })
}

/**
 * Get the budget period dates from a period string (YYYY-MM)
 * The period "2025-12" means December budget, which runs from Nov 25 to Dec 24 (if salaryDay is 25)
 * Uses weekend adjustment for salary day.
 */
export function getPeriodDates(periodStr: string, salaryDay: number): { startDate: Date; endDate: Date } {
  const [year, month] = periodStr.split('-').map(Number)

  // The start is previous month on adjusted salary day
  const startMonth = month === 1 ? 12 : month - 1
  const startYear = month === 1 ? year - 1 : year
  const startDate = getAdjustedSalaryDate(startYear, startMonth - 1, salaryDay)

  // The end is the day before the adjusted salary day of the current month
  const adjustedCurrentMonth = getAdjustedSalaryDate(year, month - 1, salaryDay)
  const endDate = new Date(adjustedCurrentMonth)
  endDate.setDate(endDate.getDate() - 1)

  return { startDate, endDate }
}

/**
 * Shift a period string (YYYY-MM) by a number of months (can be negative).
 * Used for stepping between periods with the overview arrows.
 */
export function shiftPeriod(periodStr: string, delta: number): string {
  const [year, month] = periodStr.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get array of recent periods for selection (deduplicated, guaranteed unique)
 */
export function getRecentPeriods(salaryDay: number, count: number = 6): BudgetPeriod[] {
  const periods: BudgetPeriod[] = []
  const seen = new Set<string>()
  let i = 0

  while (periods.length < count) {
    const date = subMonths(new Date(), i)
    const period = getBudgetPeriod(date, salaryDay)
    if (!seen.has(period.period)) {
      seen.add(period.period)
      periods.push(period)
    }
    i++
    if (i > count + 12) break // Safety limit
  }

  return periods
}

/**
 * Get array of upcoming periods for selection (current + future)
 */
export function getNextPeriods(salaryDay: number, count: number = 6): BudgetPeriod[] {
  const periods: BudgetPeriod[] = []

  for (let i = 0; i < count; i++) {
    const date = addMonths(new Date(), i)
    periods.push(getBudgetPeriod(date, salaryDay))
  }

  return periods
}

/**
 * Get periods from January of the current year up to one month after the current budget period.
 * Used for monthly income page where users need to select past and near-future months.
 */
export function getYearToCurrentPeriods(salaryDay: number): BudgetPeriod[] {
  const current = getCurrentBudgetPeriod(salaryDay)
  const [currentYear, currentMonth] = current.period.split('-').map(Number)
  const lastMonth = Math.min(currentMonth + 1, 12)

  const periods: BudgetPeriod[] = []
  for (let m = 1; m <= lastMonth; m++) {
    const periodStr = `${currentYear}-${String(m).padStart(2, '0')}`
    const date = new Date(currentYear, m - 1)
    periods.push({
      period: periodStr,
      startDate: getAdjustedSalaryDate(currentYear, m - 2 < 0 ? 11 : m - 2, salaryDay),
      endDate: new Date(getAdjustedSalaryDate(currentYear, m - 1, salaryDay).getTime() - 86400000),
      displayName: format(date, 'MMMM yyyy', { locale: sv }),
    })
  }

  return periods
}
