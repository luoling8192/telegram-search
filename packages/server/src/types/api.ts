import type { PublicChat, PublicFolder, PublicMessage } from './models'

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
 * Search response structure
 */
export type SearchResponse = PaginatedResponse<{
  message: PublicMessage
  chat: PublicChat
  folder?: PublicFolder
}>

/**
 * API error response
 */
export interface ErrorResponse {
  error: string
  code: string
  status: number
}
