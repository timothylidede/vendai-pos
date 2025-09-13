'use client';

import React, { useEffect, useState } from 'react';

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}

interface AIProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: ProcessingStep[];
  currentStep?: string;
  error?: string;
  onRetry?: () => void;
}

export function AIProcessingModal({ 
  isOpen, 
  onClose, 
  steps, 
  currentStep, 
  error,
  onRetry 
}: AIProcessingModalProps) {
  const [animatedSteps, setAnimatedSteps] = useState<ProcessingStep[]>([]);

  useEffect(() => {
    if (isOpen) {
      setAnimatedSteps(steps);
    }
  }, [steps, isOpen]);

  if (!isOpen) return null;

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const overallProgress = currentStepIndex >= 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!error ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl">
        <div className="relative rounded-3xl overflow-hidden backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)]">
          {/* Animated background gradients */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/3 to-cyan-600/5 animate-pulse" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-blue-500/3 to-transparent animate-pulse" style={{ animationDelay: '1s' }} />
          
          {/* Header */}
          <div className="relative p-8 pb-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-cyan-500/20 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                    {error ? (
                      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </div>
                  {!error && (
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 rounded-2xl opacity-20 blur animate-pulse" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                    {error ? 'Processing Failed' : 'AI Processing Engine'}
                  </h2>
                  <p className="text-slate-300 text-sm mt-1">
                    {error ? 'An error occurred during processing' : 'Intelligently analyzing and processing your inventory file'}
                  </p>
                </div>
              </div>
              
              {error && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 text-slate-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Overall Progress Bar */}
            {!error && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-slate-300 mb-2">
                  <span>Overall Progress</span>
                  <span>{Math.round(overallProgress)}%</span>
                </div>
                <div className="h-2 rounded-full backdrop-blur-md bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 transition-all duration-1000 ease-out relative"
                    style={{ width: `${overallProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Processing Steps */}
          <div className="relative p-8 pt-6 space-y-6 max-h-96 overflow-y-auto">
            {error ? (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/10 via-red-600/5 to-red-500/10 backdrop-blur-xl border border-red-500/20">
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-red-400 mb-2">Error Details</h3>
                      <p className="text-slate-300 text-sm leading-relaxed">{error}</p>
                    </div>
                  </div>
                </div>
                
                {onRetry && (
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={onRetry}
                      className="px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-500/90 hover:to-purple-500/90 text-white backdrop-blur-xl border border-white/20 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 rounded-xl font-medium backdrop-blur-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all duration-200"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            ) : (
              animatedSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-start space-x-4 transition-all duration-500 ${
                    index <= currentStepIndex ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  {/* Step Icon */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
                      step.status === 'completed' 
                        ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30' 
                        : step.status === 'processing'
                        ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30'
                        : step.status === 'error'
                        ? 'bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30'
                        : 'bg-gradient-to-br from-slate-600/20 to-slate-700/20 border border-slate-500/20'
                    }`}>
                      {step.status === 'completed' ? (
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : step.status === 'processing' ? (
                        <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : step.status === 'error' ? (
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                      )}
                    </div>
                    
                    {step.status === 'processing' && (
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 rounded-xl opacity-30 blur animate-pulse" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold transition-colors duration-300 ${
                      step.status === 'completed' ? 'text-green-400' :
                      step.status === 'processing' ? 'text-blue-400' :
                      step.status === 'error' ? 'text-red-400' :
                      'text-slate-300'
                    }`}>
                      {step.title}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                      {step.description}
                    </p>
                    
                    {/* Individual step progress */}
                    {step.status === 'processing' && step.progress !== undefined && (
                      <div className="mt-3">
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-500"
                            style={{ width: `${step.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with animated particles */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 opacity-20">
            <div className="h-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
