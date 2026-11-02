import { addDays, getISODay, getISOWeek, getISOWeekYear } from 'date-fns'

export interface IsoWeek {
  year: number
  week: number
}

export function isoWeekOf(date: Date): IsoWeek {
  return { year: getISOWeekYear(date), week: getISOWeek(date) }
}

/**
 * The week a new meal plan is for: this week Monday–Friday, next week on
 * Saturday and Sunday (when the shopping for the coming week is planned).
 */
export function planningWeek(today: Date): IsoWeek {
  return isoWeekOf(getISODay(today) >= 6 ? addDays(today, 7) : today)
}

/** Negative if a is before b. */
export function compareWeeks(a: IsoWeek, b: IsoWeek): number {
  return a.year !== b.year ? a.year - b.year : a.week - b.week
}
