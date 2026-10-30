'use client'

import { useEffect } from 'react'
import { THEME_COLOR } from '@/lib/utils/theme-color'

/**
 * Initializes Capacitor native plugins (StatusBar, SplashScreen).
 * Guards all plugin calls so they only run in a native context.
 */
export function useCapacitorInit() {
  useEffect(() => {
    async function init() {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) return

      const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen'),
      ])

      // Hide splash screen once React has rendered
      await SplashScreen.hide()

      // Match status bar style to current theme
      const isDark = document.documentElement.classList.contains('dark')
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })

      // iOS: set status bar background to match the header
      if (Capacitor.getPlatform() === 'ios') {
        await StatusBar.setBackgroundColor({ color: isDark ? THEME_COLOR.dark : THEME_COLOR.light })
      }

      // Re-apply on theme change
      const observer = new MutationObserver(() => {
        const dark = document.documentElement.classList.contains('dark')
        StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => null)
        if (Capacitor.getPlatform() === 'ios') {
          StatusBar.setBackgroundColor({ color: dark ? THEME_COLOR.dark : THEME_COLOR.light }).catch(() => null)
        }
      })

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })

      return () => observer.disconnect()
    }

    init().catch(console.error)
  }, [])
}

/**
 * Triggers a haptic impact. No-ops on non-native platforms.
 */
export async function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) return

  const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
  const styleMap = {
    light: ImpactStyle.Light,
    medium: ImpactStyle.Medium,
    heavy: ImpactStyle.Heavy,
  }
  await Haptics.impact({ style: styleMap[style] })
}
