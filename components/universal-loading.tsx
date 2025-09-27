'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

interface UniversalLoadingProps {
  message?: string;
  className?: string;
  showMessage?: boolean;
  type?: 'default' | 'auth' | 'loading' | 'processing' | 'initializing' | 'saving';
}

export function UniversalLoading({ 
  message, 
  className = "",
  showMessage = true,
  type = 'default'
}: UniversalLoadingProps) {
  // Default messages based on type
  const defaultMessages = {
    default: "Loading...",
    auth: "Signing you in...",
    loading: "Loading...",
    processing: "Processing...",
    initializing: "Initializing...",
    saving: "Saving changes..."
  };

  const displayMessage = message || defaultMessages[type];
  return (
    <div className={`min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-900/40 to-slate-950 flex items-center justify-center p-6 ${className}`}>
      <div className="max-w-sm w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="text-center"
        >
          {/* Continuously Spinning vendai Logo */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <motion.div
              className="relative w-20 h-20 mx-auto"
              animate={{ rotate: 360 }}
              transition={{ 
                duration: 2, 
                ease: 'linear',
                repeat: Infinity 
              }}
            >
              <Image
                src="/images/logo-icon-remove.png"
                alt="vendai Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain drop-shadow-xl"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Loading Message */}
          {showMessage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-8"
            >
              <p className="text-slate-300 text-sm">{displayMessage}</p>
            </motion.div>
          )}

          {/* Optional Loading Dots Animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex justify-center space-x-1"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-slate-400 rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}