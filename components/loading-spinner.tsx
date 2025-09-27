'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
  showMessage?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-16 h-16', 
  lg: 'w-20 h-20'
};

export function LoadingSpinner({ 
  size = 'md', 
  message, 
  className = "",
  showMessage = false 
}: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Spinning vendai Logo */}
      <motion.div
        className={`relative ${sizeClasses[size]} mb-3`}
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
          width={size === 'sm' ? 32 : size === 'md' ? 64 : 80}
          height={size === 'sm' ? 32 : size === 'md' ? 64 : 80}
          className="w-full h-full object-contain drop-shadow-lg"
          priority
        />
      </motion.div>

      {/* Optional Loading Message */}
      {showMessage && message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-slate-400 text-sm text-center"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}