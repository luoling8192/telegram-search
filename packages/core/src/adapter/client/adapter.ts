import type { NewChat, NewFolder } from '@tg-search/db'
import type { ConnectOptions, DialogsResult, Folder, ITelegramClientAdapter, MessageOptions, TelegramMessage } from '../types'

import { getConfig, useLogger } from '@tg-search/common'
import { TelegramClient } from 'telegram'

import { MediaService } from '../../services/media'
import { DialogManager } from './dialog-manager'
import { FolderManager } from './folder-manager'
import { MessageConverter } from './message-converter'
import { SessionManager } from './session-manager'

interface ClientAdapterConfig {
  apiId: number
  apiHash: string
  phoneNumber: string
  password?: string
  systemVersion?: string
}

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
  private logger = useLogger('client')
  private config: ClientAdapterConfig

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

  async connect(options?: ConnectOptions) {
    try {
      await this.mediaService.init()
      const session = await this.sessionManager.loadSession()

      if (session) {
        this.client.session = this.sessionManager.getSession()
      }

      await this.client.connect()

      if (!await this.client.isUserAuthorized()) {
        const code = options?.code || ''
        await this.client.signInUser(
          {
            apiId: this.client.apiId,
            apiHash: this.client.apiHash,
          },
          {
            phoneNumber: this.config.phoneNumber,
            phoneCode: async () => code,
            password: async () => options?.password || '',
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

  async getDialogs(offset = 0, limit = 10): Promise<DialogsResult> {
    return this.dialogManager.getDialogs(offset, limit)
  }

  async *getMessages(chatId: number, limit = 100, options?: MessageOptions): AsyncGenerator<TelegramMessage> {
    let offsetId = 0
    let hasMore = true
    let processedCount = 0

    while (hasMore) {
      // Get a batch of messages
      const messages = await this.client.getMessages(chatId, {
        limit, // Get 100 messages at a time
        offsetId, // Start from the last message of previous batch
        minId: 0, // Start from earliest message
      })

      // If we got fewer messages than requested, there are no more
      hasMore = messages.length === limit

      for (const message of messages) {
        // Check time range
        const messageTime = new Date(message.date * 1000)
        if (options?.startTime && messageTime < options.startTime) {
          continue
        }
        if (options?.endTime && messageTime > options.endTime) {
          continue
        }

        // If it's a media message, only get basic info without downloading files
        const converted = await this.messageConverter.convertMessage(message, options?.skipMedia)

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

  onMessage(callback: (message: TelegramMessage) => Promise<void>) {
    this.messageCallback = callback
  }

  async getFolders(): Promise<NewFolder[]> {
    return this.folderManager.getFolders()
  }

  async getFoldersForChat(chatId: number): Promise<Folder[]> {
    return this.folderManager.getFoldersForChat(chatId)
  }

  async getChats(): Promise<NewChat[]> {
    return this.dialogManager.getChats()
  }
}
