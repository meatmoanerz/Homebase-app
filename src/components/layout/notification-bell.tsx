'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Inbox, Banknote, Wallet, ChevronRight } from 'lucide-react'
import { BottomSheet } from '@/components/shared/bottom-sheet'
import { useNotifications, useSeenNotifications, type NotificationKind } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils/cn'

const KIND_ICON: Record<NotificationKind, typeof Inbox> = {
  import: Inbox,
  income: Banknote,
  budget: Wallet,
}

/** Header bell with unread badge; opens the list of in-app notifications. */
export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, isUnread } = useNotifications()
  const markSeen = useSeenNotifications((s) => s.markSeen)

  // Snapshot of what was unread when the sheet opened, so the dots stay
  // visible while reading even though everything is marked seen right away.
  const [unreadAtOpen, setUnreadAtOpen] = useState<Set<string>>(new Set())

  const handleOpen = () => {
    setUnreadAtOpen(new Set(notifications.filter((n) => isUnread(n.id)).map((n) => n.id)))
    markSeen(notifications.map((n) => n.id))
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          'relative w-9 h-9 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors',
          className
        )}
        aria-label={unreadCount > 0 ? `Notiser, ${unreadCount} olästa` : 'Notiser'}
      >
        <Bell className="w-[19px] h-[19px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-hb-terracotta text-white text-[10px] font-semibold grid place-items-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Notiser"
        subtitle={notifications.length === 0 ? 'Allt är hanterat' : `${notifications.length} att hantera`}
      >
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center text-center py-10 text-muted-foreground">
            <Bell className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">Inga notiser just nu.</p>
            <p className="text-xs mt-1">Nya transaktioner att granska och påminnelser dyker upp här.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => {
              const Icon = KIND_ICON[n.kind]
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-2xl bg-secondary/40 hover:bg-secondary/70 px-3.5 py-3 transition-colors"
                  >
                    <div
                      className={cn(
                        'w-9 h-9 rounded-xl grid place-items-center shrink-0',
                        n.urgent ? 'bg-hb-amber/15 text-hb-amber' : 'bg-hb-cognac/12 text-hb-cognac-deep'
                      )}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-medium truncate">{n.title}</span>
                        {unreadAtOpen.has(n.id) && <span className="w-1.5 h-1.5 rounded-full bg-hb-terracotta shrink-0" aria-label="Ny" />}
                      </div>
                      <div className={cn('text-[12px] mt-0.5', n.urgent ? 'text-hb-amber' : 'text-muted-foreground')}>{n.body}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </BottomSheet>
    </>
  )
}
