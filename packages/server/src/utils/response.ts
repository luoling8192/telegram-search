import type { ApiResponse, ErrorResponse, PaginationInfo, SuccessResponse } from '../types'

import { ErrorCode, useLogger } from '@tg-search/common'

/**
 * Create standardized response
 */
export function createResponse<T>(
  data?: T,
  error?: Error | string | ErrorCode,
  pagination?: SuccessResponse<T>['pagination'],
): ApiResponse<T> {
  if (error) {
    let responseError
    let responseCode
    switch (true) {
      case error instanceof Error:
        responseError = error.message
        responseCode = error.name
        break
      case Object.values(ErrorCode).includes(error as ErrorCode):
        responseError = error
        responseCode = error
        break
      case typeof error === 'string':
        responseError = error
        responseCode = ErrorCode.UNKNOWN_ERROR
        break
      default:
        responseError = 'Unknown error'
        responseCode = ErrorCode.UNKNOWN_ERROR
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: responseError,
      code: responseCode,
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
 * Creates a standardized error response
 * @param error - Error instance, error code, or error message
 * @returns ErrorResponse object
 */
export function createErrorResponse(error: Error | string | ErrorCode | unknown, message?: string): ErrorResponse {
  const logger = useLogger()
  logger.withError(error).error(message ?? 'an error occurred')

  if (error instanceof Error) {
    return createResponse(undefined, error) as ErrorResponse
  }
  else if (typeof error === 'string') {
    return createResponse(undefined, error) as ErrorResponse
  }
  else {
    return createResponse(undefined, message ?? ErrorCode.UNKNOWN_ERROR) as ErrorResponse
  }
}

/**
 * Creates pagination info based on total items and page parameters
 * @param total - Total number of items
 * @param page - Current page number
 * @param pageSize - Number of items per page
 * @returns PaginationInfo object
 */
export function createPaginationResponse(
  total: number,
  page: number,
  pageSize: number,
): PaginationInfo {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
