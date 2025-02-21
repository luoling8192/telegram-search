import type { MessageType } from '../../schema'

/**
 * Message input interface
 */
export interface MessageCreateInput {
  id: number
  chatId: number
  type?: MessageType
  content?: string
  fromId?: number
  fromName?: string
  fromAvatar?: {
    type: 'photo' | 'emoji'
    value: string
    color?: string
  }
  replyToId?: number
  forwardFromChatId?: number
  forwardFromChatName?: string
  forwardFromMessageId?: number
  views?: number
  forwards?: number
  links?: string[]
  metadata?: Record<string, unknown>
  createdAt: Date
}

/**
 * Search options interface
 */
export interface SearchOptions {
  chatId: number // Required for partition table lookup
  type?: MessageType
  startTime?: Date
  endTime?: Date
  limit?: number
  offset?: number
}

/**
 * Message with similarity score interface
 */
export interface MessageWithSimilarity {
  id: number
  chatId: number
  type: MessageType
  content: string | null
  createdAt: Date
  fromId: number | null
  similarity: number
}
