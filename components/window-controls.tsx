'use client'

import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

interface WindowControlsProps {
  className?: string;
}

export const WindowControls: React.FC<WindowControlsProps> = ({ className = '' }) => {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Check if we're in Electron environment after component mounts to avoid hydration issues
  useEffect(() => {
    const electronCheck = typeof window !== 'undefined' && !!window.vendaiAPI?.isElectron;
    setIsElectron(electronCheck);
    
    // Get initial window state if in Electron
    if (electronCheck && window.electronAPI) {
      window.electronAPI.isMaximized?.().then(setIsMaximized).catch(() => {});
      
      // Listen for window state changes
      const handleStateChange = (event: any, state: { isMaximized: boolean }) => {
        setIsMaximized(state.isMaximized);
      };
      
      window.electronAPI.onWindowStateChanged?.(handleStateChange);
      
      return () => {
        // Clean up listener on unmount
        if (window.electronAPI?.removeAllListeners) {
          window.electronAPI.removeAllListeners('window-state-changed');
        }
      };
    }
  }, []);

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.maximizeWindow();
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  };

  // Only show controls in Electron environment
  if (!isElectron) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {/* Minimize */}
      <button
        onClick={handleMinimize}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all duration-200 group backdrop-blur-sm border border-white/5 hover:border-white/10"
        title="Minimize"
      >
        <Minus className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
      </button>

      {/* Maximize/Restore */}
      <button
        onClick={handleMaximize}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all duration-200 group backdrop-blur-sm border border-white/5 hover:border-white/10"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <Copy className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
        ) : (
          <Square className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
        )}
      </button>

      {/* Close */}
      <button
        onClick={handleClose}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-all duration-200 group backdrop-blur-sm border border-white/5 hover:border-red-500/20"
        title="Close"
      >
        <X className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition-colors" />
      </button>
    </div>
  );
};

// Declare global interface for TypeScript
declare global {
  interface Window {
    electronAPI?: {
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      isMaximized: () => Promise<boolean>;
      onWindowStateChanged: (callback: (event: any, state: { isMaximized: boolean }) => void) => void;
      removeAllListeners: (channel: string) => void;
      googleOAuth: () => Promise<string>;
      onOAuthCallback: (callback: (event: any, url: string) => void) => void;
    };
    vendaiAPI?: {
      isElectron: boolean;
    };
  }
}