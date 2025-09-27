'use client';

import { useEffect, useState } from 'react';
import { WindowControls } from './window-controls';
import UpdateManager from './update-manager';

export function ConditionalElectronComponents() {
  const [isElectron, setIsElectron] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if we're in Electron
    const checkElectron = () => {
      return !!(
        (window as any).electronAPI || 
        (window as any).require || 
        (process as any).versions?.electron ||
        navigator.userAgent.toLowerCase().indexOf('electron') > -1
      );
    };
    setIsElectron(checkElectron());
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <>
      {isElectron && (
        <>
          {/* Window controls - only in Electron */}
          <WindowControls />
          
          {/* Update Manager - only in Electron */}
          <UpdateManager />
        </>
      )}
    </>
  );
}