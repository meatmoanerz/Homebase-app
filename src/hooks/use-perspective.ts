'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Perspective = 'all' | 'me' | 'partner'

interface PerspectiveStore {
  perspective: Perspective
  setPerspective: (p: Perspective) => void
}

export const usePerspective = create<PerspectiveStore>()(
  persist(
    (set) => ({
      perspective: 'all',
      setPerspective: (perspective) => set({ perspective }),
    }),
    {
      name: 'homebase-perspective',
    }
  )
)
