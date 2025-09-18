'use client'

import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';

interface WindowControlsProps {
  className?: string;
}

export const WindowControls: React.FC<WindowControlsProps> = ({ className = '' }) => {
  const [isElectron, setIsElectron] = useState(false);

  // Check if we're in Electron environment after component mounts to avoid hydration issues
  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.vendaiAPI?.isElectron);
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
        title="Maximize"
      >
        <Square className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
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

// Types are imported from the global types file