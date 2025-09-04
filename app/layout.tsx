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
              {/* Window controls */}
              <button 
                aria-label="minimize" 
                className="w-3 h-3 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors" 
              />
              <button 
                aria-label="maximize" 
                className="w-3 h-3 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors" 
              />
              <button 
                aria-label="close" 
                className="w-3 h-3 rounded-full bg-red-600 hover:bg-red-500 transition-colors" 
              />
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
