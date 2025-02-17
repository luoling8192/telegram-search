import type { Chat, Folder } from '@tg-search/db'
import type { messageTypeEnum } from '@tg-search/db/schema/types'

/**
 * Public chat type for API responses
 * Derived from database model but excludes sensitive fields
 */
export type PublicChat = Pick<Chat, 'id' | 'title' | 'type' | 'lastMessageDate' | 'messageCount'>

/**
 * Public folder type for API responses
 */
export type PublicFolder = Pick<Folder, 'id' | 'title' | 'emoji'>

/**
 * Public message type for API responses
 */
export interface PublicMessage {
  id: number
  chatId: number
  type: (typeof messageTypeEnum.enumValues)[number]
  content: string | null
  mediaInfo: {
    type: string
    mimeType?: string
    fileName?: string
    fileSize?: number
    width?: number
    height?: number
    duration?: number
    thumbnail?: {
      width: number
      height: number
    }
  } | null
  createdAt: Date
  fromId: number | null
  replyToId: number | null
  forwardFromChatId: number | null
  forwardFromMessageId: number | null
  views: number | null
  forwards: number | null
}
