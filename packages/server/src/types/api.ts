import type { PublicMessage } from './models'

/**
 * Base response interface for all API responses
 */
interface BaseResponse {
  success: boolean
  timestamp: string
  code?: string
  message?: string
}

/**
 * Success response with generic data type and optional pagination
 */
type SuccessResponse<T> = BaseResponse & {
  success: true
  data: T
  pagination?: PaginationInfo
}

/**
 * Pagination information structure
 */
interface PaginationInfo {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Error response with error details
 */
type ErrorResponse = BaseResponse & {
  success: false
  error: string
  code: string
  details?: Record<string, unknown>
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

/**
 * Search request parameters
 */
export interface SearchRequest extends PaginationParams {
  query: string
  folderId?: number
  chatId?: number
}

/**
 * Common pagination parameters
 */
export interface PaginationParams {
  limit?: number
  offset?: number
}

/**
 * Generic paginated response structure
 */
export interface PaginatedResponse<T> {
  total: number
  items: T[]
}

/**
 * Search result item with relevance score
 */
export interface SearchResultItem extends PublicMessage {
  score: number
}

/**
 * Search response type alias
 */
export type SearchResponse = PaginatedResponse<SearchResultItem>
