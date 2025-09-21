// Updated HomePage Component - Windows Only Download

"use client"
import { useEffect, useState } from "react"
import { useTypewriter } from "@/hooks/use-typewriter"

import { Button } from "@/components/ui/button"
import { AnimateIn } from "@/components/ui/animate"
import { ThemeToggle } from "@/components/theme-toggle"
import { Brain, Truck, CreditCard, Zap } from "lucide-react"

export default function HomePage() {
  // Simplified OS detection - only for Windows
  const [isWindows, setIsWindows] = useState<boolean>(false);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const platform = window.navigator.platform.toLowerCase();
      setIsWindows(platform.includes("win"));
    }
  }, []);

  const handleDownload = () => {
    // Always download Windows version - latest release
    const downloadUrl = "https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe";
    
    // Track download (optional analytics)
    console.log("Download started: Windows VendAI POS");
    
    // Start immediate download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'VendAI-POS-Windows-Setup.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Provide a fallback hint after a short delay in case browser blocks .exe
    setTimeout(() => {
      // If user reports failure, suggest the /download page with ZIP fallback
      // We can't detect browser download failure reliably, so we show a gentle hint instead
      const hint = document.getElementById('download-fallback-hint');
      if (hint) hint.classList.remove('hidden');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#111111] font-sans text-foreground">
      {/* Header */}
      <header className="fixed z-50 bg-white dark:bg-[#111111] rounded-xl mt-4 mx-16 left-auto right-auto" style={{left: 0, right: 0}}>
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <a href="/" className="group flex items-center gap-1 p-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg transition-all duration-300 hover:bg-[#111111]/10 dark:hover:bg-[#111111]/50 hover:scale-105">
              <img src="/logo-icon.png" alt="vendai icon" className="h-8 w-8 transition-all duration-700 group-hover:animate-[spin_2s_linear_infinite]" tabIndex={0} />
              <img src="/logo-text.png" alt="vendai" className="h-7 select-text cursor-pointer transition-all duration-300 group-hover:brightness-125" tabIndex={0} />
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="text-base font-bold bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 flex items-center gap-2 h-10"
              onClick={handleDownload}
            >
              <img src="/microsoft.png" alt="Windows" className="w-5 h-5" />
              download.
            </Button>
          </div>
        </div>
      </header>

      {/* Space for fixed header */}
      <div className="h-26"></div>

      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-5rem)] flex flex-col px-2 md:px-6 rounded-lg md:rounded-2xl mx-6 md:mx-12 overflow-hidden" style={{zIndex:1}}>
        {/* Video Background */}
        <div className="absolute inset-0 bg-[#111111] rounded-lg md:rounded-2xl">
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-4 mix-blend-luminosity"
            autoPlay
            loop
            muted
            playsInline
            style={{ transform: 'scale(1.01)' }}
            ref={(el) => {
              if (el) {
                el.playbackRate = 0.5;
              }
            }}
          >
            <source src="/videos/50s.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent opacity-80"></div>
        </div>
        
        <div className="container mx-auto max-w-3xl text-center text-white text-sm pt-20 relative z-10">
          <AnimateIn className="space-y-8">
            <h1 className="hero-title text-5xl md:text-7xl lg:text-8xl leading-tight bg-gradient-to-r from-red-500 via-green-400 to-red-500 bg-clip-text text-transparent font-sans">
              <span className="font-black">AI</span>{' '}
              <span className="inline-block font-black">
                {useTypewriter(["pos.", "retail.", "erp."])}
              </span>
            </h1>
            <p className="text-lg font-bold md:text-xl leading-relaxed max-w-3xl mx-auto opacity-90">
              vendai is a retail assistant, built with care.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 z-10">
              <Button 
                size="lg" 
                className="bg-black text-white hover:bg-gray-800 text-base px-8 py-4 h-auto font-bold flex items-center gap-2" 
                onClick={handleDownload}
              >
                <img src="/white_microsoft.png" alt="Windows" className="w-6 h-6" />
                {isWindows ? "download for windows." : "download."}
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 text-base px-8 py-4 h-auto font-bold"
                onClick={() => window.location.href = '/download'}
              >
                all downloads.
              </Button>
            </div>
          </AnimateIn>
        </div>

        {/* Demo Placeholder */}
        <div className="relative z-0 mt-12">
          <AnimateIn delay={0.4}>
            <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-4 shadow-2xl max-w-2xl mx-auto">
              <div className="bg-gray-900 dark:bg-gray-800 rounded-md p-6 font-mono text-sm">
                <div className="flex items-center gap-2 mb-4 text-gray-400">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="ml-4 font-thin">vendai dashboard.</span>
                </div>
                <div className="space-y-2 text-gray-300 font-thin">
                  <div className="text-blue-400">inventory.check().</div>
                  <div className="text-green-400">→ 15 items need restocking.</div>
                  <div className="text-yellow-400">ai.suggest_order().</div>
                  <div className="text-green-400">→ order placed with best distributor.</div>
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Rest of your component stays the same... */}
      
      {/* Note: Add a simple download status feedback */}
      {isWindows && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          <div className="bg-black/80 text-white px-3 py-2 rounded-lg text-sm opacity-80">
            Windows detected - optimized download ready
          </div>
          <div id="download-fallback-hint" className="hidden bg-yellow-500/90 text-black px-3 py-2 rounded-lg text-sm">
            Trouble downloading? Try the ZIP alternative on the <a href="/download" className="underline font-semibold">downloads page</a>.
          </div>
        </div>
      )}
    </div>
  )
}

// Usage Notes:
// 1. Remove all macOS logic and icons
// 2. Use latest release URL for always-current downloads
// 3. Add download tracking if needed
// 4. Show Windows branding consistently