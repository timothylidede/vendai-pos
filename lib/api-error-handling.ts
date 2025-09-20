/**
 * Legacy compatibility layer for existing API error handling
 * This file provides backward compatibility while using the new comprehensive error handler
 */

// Import the comprehensive error handling system
export {
  APIError,
  ErrorType,
  withErrorHandler,
  validateRequired,
  validateEmail,
  validatePhone,
  requireAuth,
  requireRole,
  handleDatabaseError,
  handleExternalServiceError,
  checkRateLimit,
  validateBusinessHours,
  validatePaymentAmount,
  validateInventoryQuantity,
  handleAPIResponse,
  createQueryErrorHandler
} from '@/lib/api-error-handler'

import { 
  APIError, 
  ErrorType, 
  withErrorHandler
} from '@/lib/api-error-handler'

// Legacy API error aliases for backward compatibility
export const VendAIApiError = APIError

export const ApiErrors = {
  ValidationError: (message: string, details?: any, requestId?: string) => 
    new APIError(ErrorType.VALIDATION_ERROR, message, details, requestId),
  
  NotFound: (resource: string, requestId?: string) => 
    new APIError(ErrorType.NOT_FOUND_ERROR, `${resource} not found`, undefined, requestId),
  
  Unauthorized: (message = 'Authentication required', requestId?: string) => 
    new APIError(ErrorType.AUTHENTICATION_ERROR, message, undefined, requestId),
  
  Forbidden: (message = 'Access denied', requestId?: string) => 
    new APIError(ErrorType.AUTHORIZATION_ERROR, message, undefined, requestId),
  
  RateLimit: (message = 'Rate limit exceeded', requestId?: string) => 
    new APIError(ErrorType.RATE_LIMIT_ERROR, message, undefined, requestId),
  
  FirebaseError: (operation: string, error: any, requestId?: string) => {
    const dbError = new APIError(ErrorType.DATABASE_ERROR, `Firebase ${operation} failed`, {
      firebaseCode: error?.code,
      firebaseMessage: error?.message
    }, requestId)
    throw dbError
  },
  
  ExternalServiceError: (service: string, error: any, requestId?: string) => 
    new APIError(ErrorType.EXTERNAL_SERVICE_ERROR, `${service} service error`, error, requestId)
}

// Legacy compatibility wrapper
export const withErrorHandling = withErrorHandler

// Legacy response helpers
export function successResponse<T>(data: T, message?: string) {
  return Response.json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  })
}
