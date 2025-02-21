import type { Chat, Folder, MessageType } from '@tg-search/db'

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
  type: MessageType
  content: string | null
  mediaInfo: Record<string, any> | null
  fromId: number | null
  fromName: string | null
  fromAvatar: {
    type: 'photo' | 'emoji'
    value: string
    color?: string
  } | null
  replyToId: number | null
  forwardFromChatId: number | null
  forwardFromChatName: string | null
  forwardFromMessageId: number | null
  views: number | null
  forwards: number | null
  links: string[] | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}
