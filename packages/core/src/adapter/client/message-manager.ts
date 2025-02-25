import type { TelegramClient } from 'telegram'
import type { GetTelegramMessageParams, TelegramMessage } from '../../types'
import type { TakeoutManager } from './takeout-manager'
import type { MessageConverter } from './utils/message-converter'

import { useLogger } from '@tg-search/common'
import bigInt from 'big-integer'
import { Api } from 'telegram/tl'

/**
 * Manager for Telegram messages
 * Handles message retrieval using different methods
 */
export class MessageManager {
  private client: TelegramClient
  private messageConverter: MessageConverter
  private takeoutManager: TakeoutManager
  private logger = useLogger()
  private messageCallback?: (message: TelegramMessage) => Promise<void>

  constructor(client: TelegramClient, messageConverter: MessageConverter, takeoutManager: TakeoutManager) {
    this.client = client
    this.messageConverter = messageConverter
    this.takeoutManager = takeoutManager
  }

  /**
   * Get messages using normal API
   */
  private async *getNormalMessages(
    chatId: number,
    limit?: number,
    options?: GetTelegramMessageParams,
  ): AsyncGenerator<TelegramMessage> {
    let offsetId = 0
    let hasMore = true
    let processedCount = 0

    while (hasMore) {
      // Get messages using normal API
      const messages = await this.client.getMessages(chatId, {
        limit: limit || 100,
        offsetId,
        minId: 0,
      })

      // If we got fewer messages than requested, there are no more
      hasMore = messages.length === (limit || 100)

      for (const message of messages) {
        // Skip empty messages
        if (message instanceof Api.MessageEmpty) {
          continue
        }

        // Check time range
        const messageTime = new Date(message.date * 1000)
        if (options?.startTime && messageTime < options.startTime) {
          continue
        }
        if (options?.endTime && messageTime > options.endTime) {
          continue
        }

        // Convert message to custom message type
        const customMessage = new Api.Message({
          ...message,
          id: message.id,
          date: message.date,
          message: message.message || '',
        })

        // If it's a media message, only get basic info without downloading files
        const converted = await this.messageConverter.convertMessage(customMessage, options?.skipMedia)

        // Check message type
        if (options?.messageTypes && !options.messageTypes.includes(converted.type)) {
          continue
        }

        yield converted
        processedCount++

        // Update offsetId to current message ID
        offsetId = message.id

        // Check if we've reached the limit
        if (options?.limit && processedCount >= options.limit) {
          return
        }
      }
    }
  }

  /**
   * Get messages from a chat using specified method
   */
  public async *getMessages(chatId: number, limit = 100, options?: GetTelegramMessageParams): AsyncGenerator<TelegramMessage> {
    if (options?.method === 'takeout') {
      try {
        // Try to use takeout first
        yield * this.takeoutManager.getMessages(chatId, limit, options)
      }
      catch (error: any) {
        // If takeout is not available, fallback to normal API
        if (error.message === 'TAKEOUT_NOT_AVAILABLE' || error.message?.includes('TAKEOUT_INIT_DELAY')) {
          this.logger.warn('Takeout session not available, using normal message fetch')
          yield * this.getNormalMessages(chatId, limit, options)
        }
        else {
          throw error
        }
      }
    }
    else {
      yield * this.getNormalMessages(chatId, limit, options)
    }
  }

  /**
   * Get chat history information
   */
  public async getHistory(chatId: number): Promise<Api.messages.TypeMessages & { count: number }> {
    return this.client.invoke(new Api.messages.GetHistory({
      peer: chatId,
      limit: 1,
      offsetId: 0,
      offsetDate: 0,
      addOffset: 0,
      maxId: 0,
      minId: 0,
      hash: bigInt(0),
    })) as Promise<Api.messages.TypeMessages & { count: number }>
  }

  /**
   * Set callback function for incoming messages
   */
  public onMessage(callback: (message: TelegramMessage) => Promise<void>): void {
    this.messageCallback = callback
  }

  /**
   * Get the current message callback function
   */
  public getMessageCallback(): ((message: TelegramMessage) => Promise<void>) | undefined {
    return this.messageCallback
  }
}
