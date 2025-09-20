/**
 * Comprehensive API error handling middleware and utilities
 * Provides consistent error responses and logging across all API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

// Error types enum
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR'
}

// Error status code mapping
const ERROR_STATUS_CODES: Record<ErrorType, number> = {
  [ErrorType.VALIDATION_ERROR]: 400,
  [ErrorType.AUTHENTICATION_ERROR]: 401,
  [ErrorType.AUTHORIZATION_ERROR]: 403,
  [ErrorType.NOT_FOUND_ERROR]: 404,
  [ErrorType.CONFLICT_ERROR]: 409,
  [ErrorType.RATE_LIMIT_ERROR]: 429,
  [ErrorType.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorType.DATABASE_ERROR]: 503,
  [ErrorType.INTERNAL_ERROR]: 500,
  [ErrorType.BUSINESS_LOGIC_ERROR]: 422
}

// Custom API Error class
export class APIError extends Error {
  public readonly type: ErrorType
  public readonly statusCode: number
  public readonly details: any
  public readonly timestamp: string
  public readonly requestId?: string

  constructor(
    type: ErrorType,
    message: string,
    details?: any,
    requestId?: string
  ) {
    super(message)
    this.name = 'APIError'
    this.type = type
    this.statusCode = ERROR_STATUS_CODES[type]
    this.details = details
    this.timestamp = new Date().toISOString()
    this.requestId = requestId

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, APIError)
  }
}

// Error response interface
interface ErrorResponse {
  success: false
  error: {
    type: ErrorType
    message: string
    details?: any
    timestamp: string
    requestId?: string
    stack?: string
  }
}

// Success response interface
interface SuccessResponse<T = any> {
  success: true
  data: T
  message?: string
  timestamp: string
  requestId?: string
}

// API Response type
export type APIResponse<T = any> = ErrorResponse | SuccessResponse<T>

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Error handler middleware
export function withErrorHandler<T = any>(
  handler: (req: NextRequest, requestId: string) => Promise<T>
) {
  return async (req: NextRequest): Promise<NextResponse<APIResponse<T>>> => {
    const requestId = generateRequestId()
    const startTime = performance.now()

    try {
      // Add request logging
      logger.info(`API Request: ${req.method} ${req.url}`, {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      })

      const result = await handler(req, requestId)
      const duration = performance.now() - startTime

      // Success response
      const response: SuccessResponse<T> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId
      }

      logger.info(`API Success: ${req.method} ${req.url}`, {
        requestId,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: 200
      })

      return NextResponse.json(response, { status: 200 })

    } catch (error) {
      const duration = performance.now() - startTime
      
      // Handle different error types
      if (error instanceof APIError) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            type: error.type,
            message: error.message,
            details: error.details,
            timestamp: error.timestamp,
            requestId: error.requestId || requestId,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
          }
        }

        logger.error(`API Error: ${req.method} ${req.url}`, {
          requestId,
          duration: `${duration.toFixed(2)}ms`,
          errorType: error.type,
          statusCode: error.statusCode,
          message: error.message,
          details: error.details,
          stack: error.stack
        })

        return NextResponse.json(errorResponse, { status: error.statusCode })
      }

      // Handle unexpected errors
      const unexpectedError = error as Error
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          type: ErrorType.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
          requestId,
          ...(process.env.NODE_ENV === 'development' && {
            details: unexpectedError.message,
            stack: unexpectedError.stack
          })
        }
      }

      logger.error(`Unexpected API Error: ${req.method} ${req.url}`, {
        requestId,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: 500,
        message: unexpectedError.message,
        stack: unexpectedError.stack
      })

      return NextResponse.json(errorResponse, { status: 500 })
    }
  }
}

// Validation helper
export function validateRequired(
  data: Record<string, any>,
  requiredFields: string[],
  requestId?: string
): void {
  const missingFields = requiredFields.filter(field => {
    const value = data[field]
    return value === undefined || value === null || value === ''
  })

  if (missingFields.length > 0) {
    throw new APIError(
      ErrorType.VALIDATION_ERROR,
      'Missing required fields',
      { missingFields },
      requestId
    )
  }
}

// Email validation
export function validateEmail(email: string, requestId?: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new APIError(
      ErrorType.VALIDATION_ERROR,
      'Invalid email format',
      { email },
      requestId
    )
  }
}

// Phone validation
export function validatePhone(phone: string, requestId?: string): void {
  const phoneRegex = /^(\+?254|0)[17]\d{8}$/
  if (!phoneRegex.test(phone)) {
    throw new APIError(
      ErrorType.VALIDATION_ERROR,
      'Invalid phone number format. Use format: +254XXXXXXXXX or 0XXXXXXXXX',
      { phone },
      requestId
    )
  }
}

// Authentication helper
export function requireAuth(userId: string | null, requestId?: string): void {
  if (!userId) {
    throw new APIError(
      ErrorType.AUTHENTICATION_ERROR,
      'Authentication required',
      undefined,
      requestId
    )
  }
}

// Authorization helper
export function requireRole(
  userRole: string,
  requiredRoles: string[],
  requestId?: string
): void {
  if (!requiredRoles.includes(userRole)) {
    throw new APIError(
      ErrorType.AUTHORIZATION_ERROR,
      'Insufficient permissions',
      { userRole, requiredRoles },
      requestId
    )
  }
}

// Database error handler
export function handleDatabaseError(error: any, operation: string, requestId?: string): never {
  logger.error(`Database error during ${operation}`, {
    requestId,
    error: error.message,
    code: error.code,
    stack: error.stack
  })

  if (error.code === 'permission-denied') {
    throw new APIError(
      ErrorType.AUTHORIZATION_ERROR,
      'Access denied to resource',
      { operation },
      requestId
    )
  }

  if (error.code === 'not-found') {
    throw new APIError(
      ErrorType.NOT_FOUND_ERROR,
      'Resource not found',
      { operation },
      requestId
    )
  }

  if (error.code === 'already-exists') {
    throw new APIError(
      ErrorType.CONFLICT_ERROR,
      'Resource already exists',
      { operation },
      requestId
    )
  }

  throw new APIError(
    ErrorType.DATABASE_ERROR,
    'Database operation failed',
    { operation, code: error.code },
    requestId
  )
}

// External service error handler
export function handleExternalServiceError(
  error: any,
  service: string,
  requestId?: string
): never {
  logger.error(`External service error: ${service}`, {
    requestId,
    service,
    error: error.message,
    status: error.status,
    stack: error.stack
  })

  throw new APIError(
    ErrorType.EXTERNAL_SERVICE_ERROR,
    `${service} service unavailable`,
    { service, status: error.status },
    requestId
  )
}

// Rate limiting helper
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
  requestId?: string
): void {
  const now = Date.now()
  const key = identifier
  const windowData = rateLimitStore.get(key)

  if (!windowData || now > windowData.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return
  }

  if (windowData.count >= limit) {
    throw new APIError(
      ErrorType.RATE_LIMIT_ERROR,
      'Rate limit exceeded',
      {
        limit,
        windowMs,
        resetTime: new Date(windowData.resetTime).toISOString()
      },
      requestId
    )
  }

  windowData.count++
  rateLimitStore.set(key, windowData)
}

// Business logic helpers
export function validateBusinessHours(requestId?: string): void {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()

  // Business hours: Monday-Saturday 6AM-10PM
  if (day === 0 || hour < 6 || hour >= 22) {
    throw new APIError(
      ErrorType.BUSINESS_LOGIC_ERROR,
      'Service unavailable outside business hours',
      {
        businessHours: 'Monday-Saturday 6:00 AM - 10:00 PM',
        currentTime: now.toISOString()
      },
      requestId
    )
  }
}

export function validatePaymentAmount(amount: number, requestId?: string): void {
  if (amount <= 0) {
    throw new APIError(
      ErrorType.VALIDATION_ERROR,
      'Payment amount must be greater than zero',
      { amount },
      requestId
    )
  }

  if (amount > 1000000) { // 1M KES limit
    throw new APIError(
      ErrorType.BUSINESS_LOGIC_ERROR,
      'Payment amount exceeds maximum limit',
      { amount, maxAmount: 1000000 },
      requestId
    )
  }
}

export function validateInventoryQuantity(quantity: number, available: number, requestId?: string): void {
  if (quantity <= 0) {
    throw new APIError(
      ErrorType.VALIDATION_ERROR,
      'Quantity must be greater than zero',
      { quantity },
      requestId
    )
  }

  if (quantity > available) {
    throw new APIError(
      ErrorType.BUSINESS_LOGIC_ERROR,
      'Insufficient inventory',
      { requested: quantity, available },
      requestId
    )
  }
}

// Client-side error handler
export async function handleAPIResponse<T>(
  response: Response
): Promise<T> {
  const data = await response.json() as APIResponse<T>

  if (!data.success) {
    const error = new Error(data.error.message)
    error.name = data.error.type
    throw error
  }

  return data.data
}

// React Query error handler
export function createQueryErrorHandler(showToast?: (message: string) => void) {
  return (error: Error) => {
    logger.error('Query error occurred', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })

    const userMessage = getUserFriendlyErrorMessage(error.name as ErrorType, error.message)
    
    if (showToast) {
      showToast(userMessage)
    }

    console.error('Query failed:', userMessage)
  }
}

// User-friendly error messages
function getUserFriendlyErrorMessage(type: ErrorType, message: string): string {
  const friendlyMessages: Record<ErrorType, string> = {
    [ErrorType.VALIDATION_ERROR]: 'Please check your input and try again',
    [ErrorType.AUTHENTICATION_ERROR]: 'Please sign in to continue',
    [ErrorType.AUTHORIZATION_ERROR]: 'You don\'t have permission to access this resource',
    [ErrorType.NOT_FOUND_ERROR]: 'The requested resource was not found',
    [ErrorType.CONFLICT_ERROR]: 'This resource already exists',
    [ErrorType.RATE_LIMIT_ERROR]: 'Too many requests. Please try again later',
    [ErrorType.EXTERNAL_SERVICE_ERROR]: 'External service is temporarily unavailable',
    [ErrorType.DATABASE_ERROR]: 'Database is temporarily unavailable',
    [ErrorType.INTERNAL_ERROR]: 'An unexpected error occurred',
    [ErrorType.BUSINESS_LOGIC_ERROR]: message // Use specific business error message
  }

  return friendlyMessages[type] || 'An error occurred. Please try again'
}