/**
 * Production-ready logging utility for VendAI POS
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any
  userId?: string
  context?: string
  stack?: string
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private logs: LogEntry[] = []
  private maxLogs = 1000 // Keep last 1000 logs in memory

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`
    return data ? `${prefix} ${message}` : `${prefix} ${message}`
  }

  private createLogEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context: this.getContext()
    }

    if (error) {
      entry.stack = error.stack
    }

    // Add user context if available
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const userStr = localStorage.getItem('currentUser')
        if (userStr) {
          const user = JSON.parse(userStr)
          entry.userId = user.uid
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    return entry
  }

  private getContext(): string {
    if (typeof window === 'undefined') return 'server'
    return `${window.location.pathname}${window.location.search}`
  }

  private storeLog(entry: LogEntry) {
    this.logs.push(entry)
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // In production, send critical logs to external service
    if (!this.isDevelopment && (entry.level === 'error' || entry.level === 'warn')) {
      this.sendToLogService(entry)
    }
  }

  private async sendToLogService(entry: LogEntry) {
    try {
      // Replace with your actual logging service endpoint
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // })
      
      console.log('Would send to log service:', entry)
    } catch (error) {
      console.error('Failed to send log to service:', error)
    }
  }

  debug(message: string, data?: any) {
    const entry = this.createLogEntry('debug', message, data)
    this.storeLog(entry)
    
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message), data)
    }
  }

  info(message: string, data?: any) {
    const entry = this.createLogEntry('info', message, data)
    this.storeLog(entry)
    
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message), data)
    }
  }

  warn(message: string, data?: any) {
    const entry = this.createLogEntry('warn', message, data)
    this.storeLog(entry)
    
    console.warn(this.formatMessage('warn', message), data)
  }

  error(message: string, error?: Error | any, data?: any) {
    const actualError = error instanceof Error ? error : new Error(String(error))
    const entry = this.createLogEntry('error', message, data, actualError)
    this.storeLog(entry)
    
    console.error(this.formatMessage('error', message), actualError, data)
  }

  // Firebase operation specific logging
  firebaseOperation(operation: string, collection?: string, docId?: string, data?: any) {
    this.info(`Firebase: ${operation}`, {
      collection,
      docId,
      data: this.isDevelopment ? data : '[hidden in production]'
    })
  }

  firebaseError(operation: string, error: any, collection?: string, docId?: string) {
    this.error(`Firebase Error: ${operation}`, error, {
      collection,
      docId,
      errorCode: error?.code,
      errorMessage: error?.message
    })
  }

  // API operation logging
  apiRequest(method: string, url: string, data?: any) {
    this.info(`API Request: ${method} ${url}`, {
      method,
      url,
      data: this.isDevelopment ? data : '[hidden in production]'
    })
  }

  apiError(method: string, url: string, error: any, status?: number) {
    this.error(`API Error: ${method} ${url}`, error, {
      method,
      url,
      status,
      errorMessage: error?.message
    })
  }

  // User action logging
  userAction(action: string, data?: any) {
    this.info(`User Action: ${action}`, data)
  }

  // Performance logging
  performanceLog(operation: string, duration: number, data?: any) {
    const level = duration > 2000 ? 'warn' : 'info'
    const message = `Performance: ${operation} took ${duration}ms`
    
    if (level === 'warn') {
      this.warn(message, data)
    } else {
      this.info(message, data)
    }
  }

  // Get recent logs (for debugging)
  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count)
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  // Clear logs
  clearLogs() {
    this.logs = []
    this.info('Logs cleared')
  }
}

// Create singleton instance
const logger = new Logger()

// Performance timing utility
export class PerformanceTimer {
  private startTime: number
  private operation: string

  constructor(operation: string) {
    this.operation = operation
    this.startTime = performance.now()
  }

  end(data?: any) {
    const duration = performance.now() - this.startTime
    logger.performanceLog(this.operation, Math.round(duration), data)
    return duration
  }
}

// Async operation wrapper with automatic logging and error handling
export async function withLogging<T>(
  operation: string,
  asyncFn: () => Promise<T>,
  context?: any
): Promise<T> {
  const timer = new PerformanceTimer(operation)
  logger.info(`Starting: ${operation}`, context)

  try {
    const result = await asyncFn()
    timer.end({ success: true })
    logger.info(`Completed: ${operation}`)
    return result
  } catch (error) {
    timer.end({ success: false, error: (error as Error).message })
    logger.error(`Failed: ${operation}`, error, context)
    throw error
  }
}

export default logger