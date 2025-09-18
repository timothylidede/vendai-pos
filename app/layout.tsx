import type { ReactNode } from 'react'
import Image from 'next/image'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { VendaiPanel } from '@/components/vendai-panel'
import { WindowControls } from '@/components/window-controls'
import UpdateManager from '@/components/update-manager'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

export const metadata = {
  title: 'VendAI - AI-Powered POS & ERP',
  description: 'Modern point of sale and ERP system with integrated AI assistance',
  generator: 'v0.app',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-900 text-slate-100 font-mono">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="vendai-theme"
        >
          {/* Thin app header with logo and window controls */}
          <header className="fixed left-0 right-0 top-0 h-10 flex items-center justify-between px-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur z-40">
            <div className="flex items-center space-x-3">
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

            <div className="flex items-center space-x-2">
              {/* Window controls */}
              <WindowControls />
            </div>
          </header>

          {/* Main content */}
          <AuthProvider>
            <main className="pt-10">
              {children}
            </main>
          </AuthProvider>
          
          {/* Update Manager */}
          <UpdateManager />
          
          {/* Vendai Panel */}
          <VendaiPanel />
          
          {/* Update Manager (Electron only) */}
          <UpdateManager />
          
          {/* AI Assistant is hosted by VendaiPanel */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
