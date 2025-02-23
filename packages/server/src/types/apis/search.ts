import type { TelegramMessage } from '@tg-search/core'
import type { PaginatedResponse, PaginationParams } from '../api'

/**
 * Search request parameters
 */
export interface SearchRequest extends PaginationParams {
  query: string
  folderId?: number
  chatId?: number
  useVectorSearch?: boolean
}

/**
 * Search result item with relevance score
 */
export interface SearchResultItem extends TelegramMessage {
  score: number
}

/**
 * Search response type alias
 */
export type SearchResponse = PaginatedResponse<SearchResultItem>
