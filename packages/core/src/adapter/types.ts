import type { MediaInfo, NewChat, NewFolder } from '@tg-search/db'

/**
 * Telegram adapter type
 */
export type TelegramAdapterType = 'bot' | 'client'

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
  messageTypes?: TelegramMessageType[]
  method?: 'getMessage' | 'takeout'
}

/**
 * Connect options for client adapter
 */
export interface ConnectOptions {
  code?: () => Promise<string>
  password?: () => Promise<string>
}

/**
 * Dialog result from Telegram
 */
export interface Dialog {
  id: number
  name: string
  type: 'user' | 'group' | 'channel'
  unreadCount: number
}

/**
 * Dialogs result from Telegram
 */
export interface DialogsResult {
  dialogs: Dialog[]
  total: number
}

/**
 * Folder from Telegram
 */
export interface Folder {
  id: number
  title: string
  emoticon?: string
}

/**
 * Base Telegram adapter interface with common functionality
 */
export interface BaseTelegramAdapter {
  /**
   * Get adapter type
   */
  readonly type: TelegramAdapterType

  /**
   * Connect to Telegram
   */
  connect: (options?: ConnectOptions) => Promise<void>

  /**
   * Disconnect from Telegram
   */
  disconnect: () => Promise<void>

  /**
   * Listen for new messages
   */
  onMessage: (callback: (message: TelegramMessage) => Promise<void>) => void
}

/**
 * Bot adapter interface with bot-specific functionality
 */
export interface ITelegramBotAdapter extends BaseTelegramAdapter {
  type: 'bot'
}

/**
 * Client adapter interface with client-specific functionality
 */
export interface ITelegramClientAdapter extends BaseTelegramAdapter {
  type: 'client'

  /**
   * Get messages from chat
   */
  getMessages: (chatId: number, limit?: number, options?: MessageOptions) => AsyncGenerator<TelegramMessage>

  /**
   * Get all dialogs (chats) with pagination
   */
  getDialogs: (offset?: number, limit?: number) => Promise<DialogsResult>

  /**
   * Get all folders from Telegram
   */
  getFolders: () => Promise<NewFolder[]>

  /**
   * Get all chats from Telegram
   */
  getChats: () => Promise<NewChat[]>

  /**
   * Get folders for a specific chat
   */
  getFoldersForChat: (chatId: number) => Promise<Folder[]>
}

/**
 * Combined Telegram adapter type
 */
export type TelegramAdapter = ITelegramBotAdapter | ITelegramClientAdapter
