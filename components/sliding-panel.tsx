'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import styles from './sliding-panel.module.css'

export function SlidingPanel() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  return (
    <>
      {/* Sliding Panel */}
      <div 
        data-expanded={isExpanded}
        className={cn(styles.slidingPanel, "border-l border-slate-700/50")}
      >
        <div className="flex-1 p-4">
          <div className="text-slate-200">
            Panel Content
          </div>
        </div>
      </div>
    </>
  )
}
