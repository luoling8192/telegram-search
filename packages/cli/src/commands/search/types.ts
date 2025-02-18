import type { MessageType } from '@tg-search/db'

/**
 * Search command options
 */
export interface SearchOptions {
  folderId?: number
  chatId?: number
  query?: string
  type?: MessageType
  startTime?: Date
  endTime?: Date
  limit?: number
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  id: number
  content: string
  createdAt: Date
  similarity: number
  views?: number
  forwards?: number
}
