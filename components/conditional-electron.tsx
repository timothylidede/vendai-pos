'use client'

import React, { useEffect, useState } from 'react'
import { detectElectron } from '@/lib/is-electron'
import { WindowControls } from './window-controls'
import UpdateManager from './update-manager'

export function ConditionalElectronComponents() {
  const [isElectron, setIsElectron] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    setIsElectron(detectElectron())
  }, [])

  if (!isMounted || !isElectron) {
    return null
  }

  return (
    <div className="flex items-center space-x-2">
      <WindowControls />
      <UpdateManager />
    </div>
  )
}