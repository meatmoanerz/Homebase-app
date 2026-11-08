/**
 * Fixed mock data for the design sandbox. Nothing here touches Supabase, so
 * the page stays static and every layout direction shows the same numbers.
 */

export const mockPeriod = {
  label: '25 okt – 24 nov',
  daysTotal: 31,
  daysElapsed: 20,
  daysLeft: 11,
}

export const mockSpend = {
  spent: 18_420,
  budget: 26_000,
  income: 41_200,
  cashOut: 12_300,
  forecast: { spend: 24_800, low: 23_600, high: 26_100 },
  savingsRoom: { room: 9_400, planned: 8_000 },
  nextInvoice: { value: 6_150, registered: 4_980 },
}

export interface MockExpense {
  id: string
  description: string
  category: string
  date: string
  amount: number
  assignment: 'personal' | 'shared' | 'partner'
}

export const mockExpenses: MockExpense[] = [
  { id: '1', description: 'ICA Maxi Haninge', category: 'Mat', date: '13 nov', amount: 1_284, assignment: 'shared' },
  { id: '2', description: 'SL-kort', category: 'Transport', date: '12 nov', amount: 1_010, assignment: 'personal' },
  { id: '3', description: 'Systembolaget', category: 'Nöje', date: '12 nov', amount: 389, assignment: 'shared' },
  { id: '4', description: 'Apotek Hjärtat', category: 'Hälsa', date: '11 nov', amount: 156, assignment: 'partner' },
  { id: '5', description: 'Pressbyrån', category: 'Mat', date: '10 nov', amount: 64, assignment: 'personal' },
]

export interface MockCategory {
  name: string
  spent: number
  budget: number
}

export const mockCategories: MockCategory[] = [
  { name: 'Mat', spent: 7_930, budget: 9_000 },
  { name: 'Transport', spent: 2_410, budget: 2_000 },
  { name: 'Nöje', spent: 2_160, budget: 3_000 },
  { name: 'Hälsa', spent: 640, budget: 1_200 },
]

export const assignmentLabel: Record<MockExpense['assignment'], string> = {
  personal: 'Egen',
  shared: 'Delad',
  partner: 'Amanda',
}
