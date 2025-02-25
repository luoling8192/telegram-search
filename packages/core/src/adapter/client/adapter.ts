import type { DatabaseFolder, DatabaseNewChat } from '@tg-search/db'
import type { Api } from 'telegram/tl'
import type { ClientAdapterConfig, ConnectOptions, GetTelegramMessageParams, ITelegramClientAdapter, TelegramChatsResult, TelegramFolder, TelegramMessage } from '../../types'

import { getConfig, useLogger } from '@tg-search/common'
import { TelegramClient } from 'telegram'

import { MediaService } from '../../services/media'
import { DialogManager } from './dialog-manager'
import { FolderManager } from './folder-manager'
import { MessageManager } from './message-manager'
import { SessionManager } from './session-manager'
import { TakeoutManager } from './takeout-manager'
import { MessageConverter } from './utils/message-converter'

/**
 * Telegram client adapter implementation
 */
export class ClientAdapter implements ITelegramClientAdapter {
  private client: TelegramClient
  private sessionManager: SessionManager
  private mediaService: MediaService
  private messageConverter: MessageConverter
  private dialogManager: DialogManager
  private folderManager: FolderManager
  private takeoutManager: TakeoutManager
  private messageManager: MessageManager
  private logger = useLogger()
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
    this.takeoutManager = new TakeoutManager(this.client, this.messageConverter)
    this.messageManager = new MessageManager(this.client, this.messageConverter, this.takeoutManager)
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

  async *getMessages(chatId: number, limit = 100, options?: GetTelegramMessageParams): AsyncGenerator<TelegramMessage> {
    yield * this.messageManager.getMessages(chatId, limit, options)
  }

  async getHistory(chatId: number): Promise<Api.messages.TypeMessages & { count: number }> {
    return this.messageManager.getHistory(chatId)
  }

  onMessage(callback: (message: TelegramMessage) => Promise<void>) {
    this.messageManager.onMessage(callback)
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
