'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Inbox, Banknote, Wallet, ChevronRight } from 'lucide-react'
import { useNotifications, type NotificationKind } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils/cn'

const KIND_ICON: Record<NotificationKind, typeof Inbox> = {
  import: Inbox,
  income: Banknote,
  budget: Wallet,
}

/** "Att göra" on the overview — the same items as the notification bell. */
export function TodoList() {
  const { notifications } = useNotifications()
  if (notifications.length === 0) return null

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <h2 className="font-serif text-[20px] font-medium tracking-tight pb-2.5">Att göra</h2>
      <div className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden">
        {notifications.slice(0, 4).map((n) => {
          const Icon = KIND_ICON[n.kind]
          return (
            <Link key={n.id} href={n.href} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl grid place-items-center shrink-0',
                  n.urgent ? 'bg-hb-amber/15 text-hb-amber' : 'bg-hb-cognac/12 text-hb-cognac-deep'
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium truncate">{n.title}</div>
                <div className={cn('text-[12px] truncate', n.urgent ? 'text-hb-amber' : 'text-muted-foreground')}>{n.body}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
            </Link>
          )
        })}
      </div>
    </motion.section>
  )
}
