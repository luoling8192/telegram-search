import type { TelegramClient } from 'telegram'
import type { GetTelegramMessageParams, TelegramMessage } from '../../types'
import type { MessageConverter } from './utils/message-converter'

import { getConfig, useLogger } from '@tg-search/common'
import bigInt from 'big-integer'
import { Api } from 'telegram/tl'

/**
 * Manager for Telegram takeout sessions
 * Handles initialization, message retrieval, and cleanup of takeout sessions
 */
export class TakeoutManager {
  private client: TelegramClient
  private messageConverter: MessageConverter
  private takeoutSession?: Api.account.Takeout
  private logger = useLogger()

  constructor(client: TelegramClient, messageConverter: MessageConverter) {
    this.client = client
    this.messageConverter = messageConverter
  }

  /**
   * Initialize takeout session for data export
   * @returns Takeout session ID
   */
  public async initTakeout(): Promise<Api.account.Takeout | null> {
    if (this.takeoutSession) {
      return this.takeoutSession
    }

    try {
      // Create new takeout session
      this.takeoutSession = await this.client.invoke(new Api.account.InitTakeoutSession({
        contacts: true,
        messageUsers: true,
        messageChats: true,
        messageMegagroups: true,
        messageChannels: true,
        files: true,
        fileMaxSize: bigInt(1024 * 1024 * 1024), // 1GB
      }))

      return this.takeoutSession
    }
    catch (error: any) {
      // Check if we need to wait
      if (error?.message?.includes('TAKEOUT_INIT_DELAY')) {
        this.logger.warn('Takeout session not available, using normal message fetch')
        return null
      }
      throw error
    }
  }

  /**
   * Finish takeout session
   */
  public async finishTakeout(): Promise<void> {
    if (!this.takeoutSession) {
      return
    }

    const appConfig = getConfig()
    // maxRetries = 0 means infinite retries
    const maxRetries = appConfig.message?.export?.maxTakeoutRetries ?? 3
    let retryCount = 0
    let lastError: Error | null = null
    const waitTime = 30 * 1000 // 30 seconds

    // eslint-disable-next-line no-unmodified-loop-condition
    while (maxRetries === 0 || retryCount < maxRetries) {
      try {
        await this.client.invoke(new Api.account.FinishTakeoutSession({
          success: true,
        }))
        this.takeoutSession = undefined
        this.logger.log('成功结束 takeout 会话')
        return
      }
      catch (error: any) {
        lastError = error
        // Check if we need to wait for takeout
        if (error?.message?.includes('TAKEOUT_REQUIRED')) {
          const retryInfo = maxRetries === 0
            ? '无限重试'
            : `第 ${retryCount + 1}/${maxRetries} 次重试`
          this.logger.warn(`等待 takeout 会话完成...（${retryInfo}，等待 ${waitTime / 1000} 秒）`)
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, waitTime))
          retryCount++
          continue
        }
        // For other errors, throw immediately
        this.logger.error(`结束 takeout 会话时遇到未知错误：${error.message}`)
        throw error
      }
    }

    // If we've exhausted all retries, throw the last error
    if (lastError) {
      this.logger.error(`结束 takeout 会话失败，已重试 ${maxRetries} 次`)
      throw lastError
    }
  }

  /**
   * Convert raw message to custom message type
   * @param message Raw message from Telegram API
   * @returns Custom message type
   */
  private convertToCustomMessage(message: any): Api.Message {
    // Basic message properties
    const baseProps = {
      id: message.id,
      date: message.date,
      message: message.message || '',
    }

    // Boolean flags with default false
    const booleanFlags = [
      'out',
      'mentioned',
      'mediaUnread',
      'silent',
      'post',
      'fromScheduled',
      'legacy',
      'editHide',
      'pinned',
      'noforwards',
    ].reduce((acc, key) => ({
      ...acc,
      [key]: message[key] || false,
    }), {})

    // Direct property mappings
    const directProps = [
      'peerId',
      'fwdFrom',
      'viaBotId',
      'replyTo',
      'media',
      'replyMarkup',
      'entities',
      'views',
      'forwards',
      'replies',
      'editDate',
      'postAuthor',
      'groupedId',
      'reactions',
      'restrictionReason',
      'ttlPeriod',
    ].reduce((acc, key) => ({
      ...acc,
      [key]: message[key],
    }), {})

    return new Api.Message({
      ...baseProps,
      ...booleanFlags,
      ...directProps,
    })
  }

  /**
   * Get messages using takeout API
   */
  public async *getMessages(
    chatId: number,
    limit: number,
    options?: GetTelegramMessageParams,
  ): AsyncGenerator<TelegramMessage> {
    let offsetId = 0
    let hasMore = true
    let processedCount = 0

    try {
      // Initialize takeout session
      const takeoutSession = await this.initTakeout()
      if (!takeoutSession) {
        throw new Error('TAKEOUT_NOT_AVAILABLE')
      }

      while (hasMore) {
        // Get messages using takeout
        const query = new Api.messages.GetHistory({
          peer: await this.client.getInputEntity(chatId),
          offsetId,
          addOffset: 0,
          limit,
          maxId: 0,
          minId: 0,
          hash: bigInt(0),
        })

        const result = await this.client.invoke(
          new Api.InvokeWithTakeout({
            takeoutId: takeoutSession.id,
            query,
          }),
        ) as Api.messages.MessagesSlice | Api.messages.Messages | Api.messages.ChannelMessages

        // Check if we have messages
        if (!('messages' in result)) {
          break
        }

        const messages = result.messages as Api.Message[]

        // If we got fewer messages than requested, there are no more
        hasMore = messages.length === limit

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
          const customMessage = this.convertToCustomMessage(message)

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
    finally {
      // Always finish takeout session
      await this.finishTakeout()
    }
  }

  /**
   * Check if takeout is available
   * @returns True if takeout is available
   */
  public isTakeoutSessionActive(): boolean {
    return !!this.takeoutSession
  }
}
