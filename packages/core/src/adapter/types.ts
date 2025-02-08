import { MediaInfo } from '../db/schema/message'

/**
 * Telegram adapter type
 */
export type TelegramAdapterType = 'bot' | 'client'

/**
 * Message type from Telegram
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
  mediaInfo?: MediaInfo
  fromId?: number
  replyToId?: number
  forwardFromChatId?: number
  forwardFromMessageId?: number
  views?: number
  forwards?: number
  createdAt: Date
}

/**
 * Telegram adapter interface
 */
export interface TelegramAdapter {
  /**
   * Get adapter type
   */
  readonly type: TelegramAdapterType

  /**
   * Connect to Telegram
   */
  connect(): Promise<void>

  /**
   * Disconnect from Telegram
   */
  disconnect(): Promise<void>

  /**
   * Get messages from chat
   */
  getMessages(chatId: number, limit?: number): AsyncGenerator<TelegramMessage>

  /**
   * Listen for new messages
   */
  onMessage(callback: (message: TelegramMessage) => Promise<void>): void
}

export interface Dialog {
  id: number
  name: string
  type: 'user' | 'group' | 'channel' | 'saved'
  unreadCount: number
  lastMessage?: string
  lastMessageDate?: Date
}
