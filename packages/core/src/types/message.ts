import type { MediaInfo } from '@tg-search/db'

/**
 * Message type
 */
export type MessageType = 'text' | 'photo' | 'video' | 'document' | 'sticker' | 'other'

/**
 * Message from Telegram
 */
export interface Message {
  id: number
  chatId: number
  type: MessageType
  content?: string
  mediaInfo?: MediaInfo
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
 * Message options for getting messages
 */
export interface MessageOptions {
  skipMedia?: boolean
  startTime?: Date
  endTime?: Date
  limit?: number
  messageTypes?: MessageType[]
  method?: 'getMessage' | 'takeout'
}
