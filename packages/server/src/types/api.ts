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
 * Search response structure
 */
export interface SearchResponse {
  total: number
  items: Array<{
    message: PublicMessage
    chat: PublicChat
    folder?: PublicFolder
  }>
}

/**
 * API error response
 */
export interface ErrorResponse {
  error: string
  code: string
  status: number
}
