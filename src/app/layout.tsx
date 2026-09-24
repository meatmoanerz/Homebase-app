import type { Metadata, Viewport } from "next"
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Homebase",
  description: "Håll koll på din budget, utgifter och sparande",
  manifest: "/manifest.json",
  metadataBase: new URL("https://homebase-app-omega.vercel.app"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Homebase",
    description: "Håll koll på din budget, utgifter och sparande",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Homebase" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Homebase",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#c08850",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
