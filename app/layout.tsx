import type { ReactNode } from 'react'
import Image from 'next/image'
import { ThemeProvider } from '@/components/theme-provider'
import { VendaiPanel } from '@/components/vendai-panel'
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
              <Image 
                src="/images/logo-icon.png" 
                alt="VendAI"
                width={24} 
                height={24} 
                className="rounded-sm transition-transform hover:rotate-180 duration-500" 
              />
            </div>

            <div className="flex items-center space-x-2">
              {/* Minimal window controls: white icons, no background, ordered minimize, restore, close */}
              <button 
                aria-label="minimize" 
                className="w-5 h-5 flex items-center justify-center transition-colors mr-1 rounded-sm"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="6" width="6" height="1.5" fill="#fff" />
                </svg>
              </button>
              <button 
                aria-label="restore" 
                className="w-5 h-5 flex items-center justify-center transition-colors mr-1 rounded-sm"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="6" height="6" stroke="#fff" strokeWidth="1.5" rx="0.5"/>
                </svg>
              </button>
              <button 
                aria-label="close" 
                className="w-5 h-5 flex items-center justify-center transition-colors rounded-sm"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="3" y1="3" x2="9" y2="9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="9" y1="3" x2="3" y2="9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </header>

          {/* Main content */}
          <main className="pt-10">
            {children}
          </main>
          
          {/* Vendai Panel */}
          <VendaiPanel />
          
          {/* AI Assistant is hosted by VendaiPanel */}
        </ThemeProvider>
      </body>
    </html>
  )
}
