/**
 * Colour of the iOS status bar / browser chrome (theme-color). It matches the
 * mobile header (.glass over the page background) so the status bar and the
 * header read as one bar.
 */
export const THEME_COLOR = {
  light: '#f9f5ec',
  dark: '#221d17',
} as const

/**
 * Runs in <head> before the page paints: sets theme-color from the theme
 * picked in the app (next-themes, key "stacka-theme"), not only the system
 * setting. iOS picks the status bar colour at launch, before React loads.
 */
export const themeColorScript = `(function(){try{var t=localStorage.getItem('stacka-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var c=t==='dark'?'${THEME_COLOR.dark}':'${THEME_COLOR.light}';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c)})}catch(e){}})()`
