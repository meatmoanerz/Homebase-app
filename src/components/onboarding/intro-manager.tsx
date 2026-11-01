'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useUser, usePartner } from '@/hooks/use-user'
import { useIntros, useMarkIntroSeen } from '@/hooks/use-modules'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { TOUR_PATHS, getTour, introKey, type TourKey } from '@/components/onboarding/tours'

// Waits for the page's own entry animation before measuring targets.
const SHOW_DELAY_MS = 700

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
    const timer = window.setTimeout(() => setReadyTour(tour), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
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
