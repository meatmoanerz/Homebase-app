import { redirect } from 'next/navigation'

// "Visa min månad" grew into the Analys page; keep old links working.
export default function ReportPage() {
  redirect('/analys')
}
