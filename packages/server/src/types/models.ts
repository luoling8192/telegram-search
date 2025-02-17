import type { Chat, Folder } from '@tg-search/db'
import type { chatTypeEnum } from '@tg-search/db/schema/types'

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
  date: Date
  text: string
  type: (typeof chatTypeEnum.enumValues)[number]
  chatId: number
  folderId?: number
  replyToMessageId?: number
  media?: {
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
  }
}
