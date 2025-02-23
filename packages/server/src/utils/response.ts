import type { ApiResponse, ErrorResponse, SuccessResponse } from '../types'

/**
 * Create standardized response
 */
export function createResponse<T>(
  data?: T,
  error?: unknown,
  pagination?: SuccessResponse<T>['pagination'],
): ApiResponse<T> {
  if (error) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error',
      code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
    }

    // Add additional error details if available
    if (error instanceof Error && (error as any).details) {
      errorResponse.details = (error as any).details
    }

    return errorResponse
  }

  return {
    success: true,
    data: data as T,
    timestamp: new Date().toISOString(),
    pagination,
  }
}
