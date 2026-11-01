'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useUser, usePartner } from '@/hooks/use-user'
import { useIntros, useMarkIntroSeen } from '@/hooks/use-modules'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { TOUR_PATHS, getTour, introKey, type TourKey } from '@/components/onboarding/tours'

// Waits for the page's own entry animation before measuring targets.
const SHOW_DELAY_MS = 700
const OPEN_DIALOG_SELECTOR = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'

/**
 * Shows a page's introduction the first time the user opens it. Mounted once
 * in the app shell. Seen intros are stored on the profile so they follow the
 * user between devices.
 */
export function IntroManager() {
  const pathname = usePathname()
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { ready, hasSeen } = useIntros()
  const markSeen = useMarkIntroSeen()
  const [readyTour, setReadyTour] = useState<TourKey | null>(null)

  const tour = TOUR_PATHS[pathname] ?? null
  const eligible = !!tour && ready && !!user?.onboarding_completed && !hasSeen(introKey(tour))

  useEffect(() => {
    if (!eligible || !tour) return
    // A modal dialog (e.g. the income reminder) blocks clicks everywhere else,
    // so the tour waits until no dialog is open.
    let poll: number | undefined
    const timer = window.setTimeout(() => {
      const tryShow = () => {
        if (document.querySelector(OPEN_DIALOG_SELECTOR)) return false
        setReadyTour(tour)
        return true
      }
      if (!tryShow()) {
        poll = window.setInterval(() => {
          if (tryShow()) window.clearInterval(poll)
        }, 400)
      }
    }, SHOW_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(poll)
    }
  }, [eligible, tour])

  const active = eligible && readyTour === tour ? tour : null
  if (!active || !user) return null

  const steps = getTour(active, { hasPartner: !!partner, ccmEnabled: !!user.ccm_enabled })

  return (
    <GuidedTour
      key={active}
      steps={steps}
      onClose={() => {
        markSeen.mutate({ userId: user.id, key: introKey(active) })
        setReadyTour(null)
      }}
    />
  )
}
