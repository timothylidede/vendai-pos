'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // Add your error logging service here (Sentry, LogRocket, etc.)
      this.logErrorToService(error, errorInfo)
    }

    this.setState({
      hasError: true,
      error,
      errorInfo
    })
  }

  logErrorToService = (error: Error, errorInfo: React.ErrorInfo) => {
    // Implement your error logging service
    console.error('Logging to error service:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback component if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} resetError={this.handleReset} />
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full glass rounded-xl border border-red-500/30 p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-red-400 mb-4">
              Oops! Something went wrong
            </h1>
            
            <p className="text-slate-300 mb-6">
              We encountered an unexpected error. This has been logged and our team will investigate.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-slate-800 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-orange-400 font-semibold mb-2">Development Error Details:</h3>
                <p className="text-red-300 text-sm font-mono mb-2">{this.state.error.message}</p>
                {this.state.error.stack && (
                  <details className="text-slate-400 text-xs">
                    <summary className="cursor-pointer hover:text-slate-300">Stack Trace</summary>
                    <pre className="mt-2 overflow-x-auto">{this.state.error.stack}</pre>
                  </details>
                )}
              </div>
            )}

            <div className="space-y-3">
              <Button 
                onClick={this.handleReset}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full border-slate-600 hover:bg-slate-800"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

// Hook for error handling in functional components
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: any) => {
    console.error('Manual error report:', error, errorInfo)
    
    // In production, log to error service
    if (process.env.NODE_ENV === 'production') {
      // Add your error logging service here
      console.error('Logging manual error:', {
        message: error.message,
        stack: error.stack,
        errorInfo,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }
  }, [])
}