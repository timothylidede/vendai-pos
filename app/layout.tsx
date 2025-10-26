import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Script from 'next/script'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { HardwareProvider } from '@/contexts/hardware-context'
import { VendaiPanel } from '@/components/vendai-panel'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/error-boundary'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'
import './globals.css'

export const metadata: Metadata = {
  title: 'vendai - AI-Powered POS & ERP',
  description: 'Modern point of sale and ERP system with integrated AI assistance',
  generator: 'v0.app',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="vendai-env" strategy="beforeInteractive">
          {`
            (function(){
              var win = window;
              var nav = typeof navigator !== 'undefined' ? navigator : { userAgent: '' };
              var lowerUA = (nav.userAgent || '').toLowerCase();
              var hostname = win.location && win.location.hostname ? win.location.hostname : '';
              win.VENDAI_ENV = {
                isElectron: Boolean(win.electronAPI || win.vendaiAPI?.isElectron || typeof win.require === 'function' || lowerUA.indexOf('electron') > -1),
                isVercel: hostname.indexOf('vercel.app') !== -1 || hostname === 'app.vendai.digital'
              };
              if (win.VENDAI_ENV.isElectron) {
                document.documentElement.dataset.isElectron = 'true';
              }
            })();
          `}
        </Script>
      </head>
  <body className="font-mono selection:bg-sky-500/30 selection:text-white">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="vendai-theme"
        >
          {/* Service Worker for offline image caching */}
          <ServiceWorkerRegistration />
          
          {/* Main content */}
          <AuthProvider>
            <HardwareProvider>
              <ErrorBoundary>
                <main>
                  {children}
                </main>
              </ErrorBoundary>
            </HardwareProvider>
          </AuthProvider>
          
          {/* vendai Panel - Hidden */}
          {/* <VendaiPanel /> */}
          
          {/* AI Assistant is hosted by VendaiPanel */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
