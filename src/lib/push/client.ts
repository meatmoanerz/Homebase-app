/**
 * Client-side helpers for Web Push subscriptions.
 * The public VAPID key is safe to ship in the client bundle.
 */

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BKyO5Je9kuTj0yu3eVZJl9KRbH0_7hY75HysZVSeaYuY0FuY4PBzWXNZ6D1cqDPNNwKEuhUFl0xE0uaj361hMgQ'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js')
}

/**
 * Request permission, subscribe to push, and save the subscription server-side.
 * Returns true on success.
 */
export async function enablePushOnThisDevice(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return { ok: false, error: 'Push stöds inte i den här webbläsaren. På iPhone: lägg appen på hemskärmen och öppna den därifrån.' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: 'Notiser nekades. Tillåt notiser för Homebase i systeminställningarna.' }
  }

  const registration = await registerServiceWorker()
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })
  }

  const res = await fetch('/api/push/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  })

  if (!res.ok) {
    return { ok: false, error: 'Kunde inte spara prenumerationen' }
  }
  return { ok: true }
}

/** Unsubscribe this device and remove the subscription server-side. */
export async function disablePushOnThisDevice(): Promise<void> {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await fetch('/api/push/subscription', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
    await subscription.unsubscribe()
  }
}

/** Whether this device currently has an active push subscription. */
export async function isPushEnabledOnThisDevice(): Promise<boolean> {
  if (!pushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return !!subscription && Notification.permission === 'granted'
}
