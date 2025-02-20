// Response type definitions
export interface BaseResponse {
  success: boolean
  timestamp: string
  code?: string
  message?: string
}

export type SuccessResponse<T> = BaseResponse & {
  success: true
  data: T
  pagination?: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export type ErrorResponse = BaseResponse & {
  success: false
  error: string
  code: string
  details?: Record<string, unknown>
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

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

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string = 'API_ERROR',
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = code
  }
}
