import type { ReactNode } from 'react'
import Image from 'next/image'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { VendaiPanel } from '@/components/vendai-panel'
import { ConditionalElectronComponents } from '@/components/conditional-electron'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/error-boundary'
import './globals.css'

export const metadata = {
  title: 'VendAI - AI-Powered POS & ERP',
  description: 'Modern point of sale and ERP system with integrated AI assistance',
  generator: 'v0.app',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            window.VENDAI_ENV = {
              isElectron: !!(window.electronAPI || window.require || navigator.userAgent.toLowerCase().indexOf('electron') > -1),
              isVercel: window.location.hostname.includes('vercel.app') || window.location.hostname === 'app.vendai.digital'
            };
          `
        }} />
      </head>
      <body className="bg-slate-900 text-slate-100 font-mono">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="vendai-theme"
        >
          {/* Thin app header with logo and conditional window controls */}
          <header className="fixed left-0 right-0 top-0 h-10 flex items-center justify-between px-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur z-40"
                  style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex items-center space-x-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
              <a href="/modules" aria-label="Go to Modules Dashboard">
                <Image 
                  src="/images/logo-icon.png" 
                  alt="VendAI"
                  width={24} 
                  height={24} 
                  className="rounded-sm transition-transform hover:rotate-180 duration-500 cursor-pointer" 
                />
              </a>
            </div>

            <div className="flex items-center space-x-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
              {/* Conditional window controls - only shows in Electron */}
              <ConditionalElectronComponents />
            </div>
          </header>

          {/* Main content */}
          <AuthProvider>
            <ErrorBoundary>
              <main className="pt-10">
                {children}
              </main>
            </ErrorBoundary>
          </AuthProvider>
          
          {/* Vendai Panel */}
          <VendaiPanel />
          
          {/* AI Assistant is hosted by VendaiPanel */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
