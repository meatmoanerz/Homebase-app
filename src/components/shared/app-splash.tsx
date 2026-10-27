/**
 * Full-screen branded loading screen. Same size and position as the iOS
 * startup images (public/splash), so launching the home-screen app goes from
 * the static startup image straight into this one without a jump. The copper
 * dot breathes; a short line fades in only if loading takes a while.
 * Server-safe (no client JS) so it can stream before anything else.
 */
export function AppSplash() {
  return (
    <div
      className="fixed inset-0 z-[300] grid place-items-center bg-background"
      role="status"
      aria-live="polite"
      aria-label="Laddar Homebase"
    >
      <div className="flex flex-col items-center">
        <svg width="88" height="88" viewBox="0 0 1024 1024" aria-hidden="true" className="splash-icon">
          <rect width="1024" height="1024" rx="230" fill="#3d3128" />
          <path
            d="M332 236 V788 M332 540 L512 402 L692 540 V788"
            fill="none"
            stroke="#f4ede3"
            strokeWidth="100"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="512" cy="690" r="56" fill="#c08850" className="splash-dot" />
        </svg>
      </div>
      <p className="splash-hint absolute left-0 right-0 text-center text-[13px] text-muted-foreground" style={{ top: 'calc(50% + 72px)' }}>
        Hämtar din ekonomi…
      </p>
    </div>
  )
}
