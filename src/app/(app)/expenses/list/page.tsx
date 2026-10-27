import { redirect } from 'next/navigation'

// The Utgifter list now lives in Analys (search, filters and editing).
export default function ExpenseListPage() {
  redirect('/analys')
}
