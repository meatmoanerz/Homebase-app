import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'se.homebase.app',
  appName: 'Homebase',
  webDir: 'out',
  server: {
    // TODO: Replace with your deployed Vercel URL
    url: 'https://YOUR_DEPLOYED_URL',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#f4ede3',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
}

export default config
