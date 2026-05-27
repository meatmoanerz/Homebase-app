import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Panel - Homebase',
  description: 'Homebase Administration Panel',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
