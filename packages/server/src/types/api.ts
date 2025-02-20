import type { PublicMessage } from './models'

/**
 * Search request parameters
 */
export interface SearchRequest {
  query: string
  folderId?: number
  chatId?: number
  limit?: number
  offset?: number
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number
  offset?: number
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  total: number
  items: T[]
}

/**
 * Search result item with score
 */
export interface SearchResultItem extends PublicMessage {
  score: number
}

/**
 * Search response structure
 */
export type SearchResponse = PaginatedResponse<SearchResultItem>

/**
 * API error response
 */
export interface ErrorResponse {
  error: string
  code: string
  status: number
}
