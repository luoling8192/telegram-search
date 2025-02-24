import type { DatabaseFolder, DatabaseNewChat } from '@tg-search/db'
import type { ClientAdapterConfig, ConnectOptions, GetTelegramMessageParams, ITelegramClientAdapter, TelegramChatsResult, TelegramFolder, TelegramMessage } from '../../types'

import { getConfig, useLogger } from '@tg-search/common'
import bigInt from 'big-integer'
import { TelegramClient } from 'telegram'
import { Api } from 'telegram/tl'

import { MediaService } from '../../services/media'
import { DialogManager } from './dialog-manager'
import { FolderManager } from './folder-manager'
import { MessageConverter } from './message-converter'
import { SessionManager } from './session-manager'

/**
 * Telegram client adapter implementation
 */
export class ClientAdapter implements ITelegramClientAdapter {
  private client: TelegramClient
  private messageCallback?: (message: TelegramMessage) => Promise<void>
  private sessionManager: SessionManager
  private mediaService: MediaService
  private messageConverter: MessageConverter
  private dialogManager: DialogManager
  private folderManager: FolderManager
  private logger = useLogger()
  private config: ClientAdapterConfig
  private takeoutSession?: Api.account.Takeout

  constructor(config: ClientAdapterConfig) {
    this.config = {
      systemVersion: 'Unknown',
      ...config,
    }
    const appConfig = getConfig()
    this.sessionManager = new SessionManager(appConfig.path.session)

    // Create client with session
    this.client = new TelegramClient(
      this.sessionManager.getSession(),
      config.apiId,
      config.apiHash,
      { connectionRetries: 5 },
    )

    // Initialize services
    this.mediaService = new MediaService(this.client)
    this.messageConverter = new MessageConverter(this.mediaService, this.client)
    this.dialogManager = new DialogManager(this.client)
    this.folderManager = new FolderManager(this.client)
  }

  get type() {
    return 'client' as const
  }

  async isConnected() {
    return this.client.isUserAuthorized()
  }

  async connect(options?: ConnectOptions) {
    try {
      await this.mediaService.init()
      const session = await this.sessionManager.loadSession()

      if (session) {
        this.client.session = this.sessionManager.getSession()
      }

      await this.client.connect()

      if (!await this.client.isUserAuthorized()) {
        await this.client.signInUser(
          {
            apiId: this.client.apiId,
            apiHash: this.client.apiHash,
          },
          {
            phoneNumber: this.config.phoneNumber,
            phoneCode: async () => {
              if (typeof options?.code === 'function') {
                return options.code()
              }
              return options?.code || ''
            },
            password: async () => {
              if (typeof options?.password === 'function') {
                return options.password()
              }
              return options?.password || ''
            },
            onError: (err: Error) => {
              this.logger.withError(err).error('登录失败')
              throw err
            },
          },
        )
      }

      const sessionString = await this.client.session.save() as unknown as string
      await this.sessionManager.saveSession(sessionString)
      this.logger.log('登录成功')
    }
    catch (error) {
      this.logger.withError(error).error('连接失败')
      throw error
    }
  }

  async disconnect() {
    await this.client.disconnect()
  }

  async getPaginationDialogs(offset = 0, limit = 10): Promise<TelegramChatsResult> {
    return this.dialogManager.getPaginationDialogs(offset, limit)
  }

  /**
   * Initialize takeout session for data export
   * @returns Takeout session ID
   */
  private async initTakeout(): Promise<Api.account.Takeout | null> {
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
  private async finishTakeout(): Promise<void> {
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
  private async *takeoutMessages(
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

  async *getMessages(chatId: number, limit = 100, options?: GetTelegramMessageParams): AsyncGenerator<TelegramMessage> {
    if (options?.method === 'takeout') {
      try {
      // Try to use takeout first
        yield * this.takeoutMessages(chatId, limit, options)
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

  async getHistory(chatId: number): Promise<Api.messages.TypeMessages & { count: number }> {
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

  onMessage(callback: (message: TelegramMessage) => Promise<void>) {
    this.messageCallback = callback
  }

  async getFolders(): Promise<DatabaseFolder[]> {
    return this.folderManager.getFolders()
  }

  async getFoldersForChat(chatId: number): Promise<TelegramFolder[]> {
    return this.folderManager.getFoldersForChat(chatId)
  }

  async getDialogs(): Promise<DatabaseNewChat[]> {
    return this.dialogManager.getDialogs()
  }
}
