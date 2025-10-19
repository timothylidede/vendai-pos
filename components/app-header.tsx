'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { detectElectron } from '@/lib/is-electron'
import { ConditionalElectronComponents } from '@/components/conditional-electron'

export function AppHeader() {
  const [isElectron, setIsElectron] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    setIsElectron(detectElectron())
  }, [])

  const dragRegionStyle = useMemo(() => {
    return (isMounted && isElectron) ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined
  }, [isMounted, isElectron])

  const interactiveRegionStyle = useMemo(() => {
    return (isMounted && isElectron) ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined
  }, [isMounted, isElectron])

  if (!isMounted) {
    return null
  }

  if (!isElectron) {
    return null
  }

  return (
    <header
      className="fixed left-0 right-0 top-0 h-10 flex items-center justify-between px-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur z-40"
      style={dragRegionStyle}
    >
      <div className="flex items-center space-x-3" style={interactiveRegionStyle}>
        <a href="/modules" aria-label="Go to Modules Dashboard">
          <Image
            src="/images/logo-icon-remove.png"
            alt="vendai"
            width={24}
            height={24}
            className="rounded-sm transition-transform hover:rotate-180 duration-500 cursor-pointer"
          />
        </a>
      </div>

      <div className="flex items-center space-x-2" style={interactiveRegionStyle}>
        {isMounted && <ConditionalElectronComponents />}
      </div>
    </header>
  )
}
