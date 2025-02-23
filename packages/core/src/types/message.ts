import type { DatabaseMediaInfo } from '@tg-search/db'

/**
 * Message type
 */
export type TelegramMessageType = 'text' | 'photo' | 'video' | 'document' | 'sticker' | 'other'

/**
 * Message from Telegram
 */
export interface TelegramMessage {
  id: number
  chatId: number
  type: TelegramMessageType
  content?: string
  mediaInfo?: DatabaseMediaInfo
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
export interface GetTelegramMessageParams {
  skipMedia?: boolean
  startTime?: Date
  endTime?: Date
  limit?: number
  messageTypes?: TelegramMessageType[]
  method?: 'getMessage' | 'takeout'
}
