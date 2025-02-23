import type { Folder, NewChat, NewFolder } from '@tg-search/db'
import type { MessageOptions } from 'node:child_process'
import type { ChatsResult } from './chat'
import type { Message } from './message'

/**
 * Telegram adapter type
 */
export type TelegramAdapterType = 'bot' | 'client'

/**
 * Combined Telegram adapter type
 */
export type TelegramAdapter = ITelegramBotAdapter | ITelegramClientAdapter

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
  connect: (options?: {
    code?: () => Promise<string>
    password?: () => Promise<string>
  }
  ) => Promise<void>

  /**
   * Disconnect from Telegram
   */
  disconnect: () => Promise<void>

  /**
   * Listen for new messages
   */
  onMessage: (callback: (message: Message) => Promise<void>) => void
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
   * Check if the client is connected
   */
  isConnected: () => Promise<boolean>

  /**
   * Get messages from chat
   */
  getMessages: (chatId: number, limit?: number, options?: MessageOptions) => AsyncGenerator<Message>

  /**
   * Get all dialogs (chats) with pagination
   */
  getDialogs: (offset?: number, limit?: number) => Promise<ChatsResult>

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
