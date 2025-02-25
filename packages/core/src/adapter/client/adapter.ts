import type { DatabaseFolder, DatabaseNewChat } from '@tg-search/db'
import type { Api } from 'telegram/tl'
import type { ClientAdapterConfig, ConnectOptions, GetTelegramMessageParams, ITelegramClientAdapter, TelegramChatsResult, TelegramFolder, TelegramMessage } from '../../types'

import { getConfig, useLogger } from '@tg-search/common'

import { MediaService } from '../../services/media'
import { ConnectionManager } from './connection-manager'
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
  private sessionManager: SessionManager
  private connectionManager: ConnectionManager
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

    // Initialize session and connection managers
    this.sessionManager = new SessionManager(appConfig.path.session)
    this.connectionManager = new ConnectionManager(
      this.sessionManager,
      config.apiId,
      config.apiHash,
      config.phoneNumber,
    )

    // Get client instance
    const client = this.connectionManager.getClient()

    // Initialize services
    this.mediaService = new MediaService(client)
    this.messageConverter = new MessageConverter(this.mediaService, client)
    this.dialogManager = new DialogManager(client)
    this.folderManager = new FolderManager(client)
    this.takeoutManager = new TakeoutManager(client, this.messageConverter)
    this.messageManager = new MessageManager(client, this.messageConverter, this.takeoutManager)
  }

  get type() {
    return 'client' as const
  }

  async isConnected() {
    return this.connectionManager.isConnected()
  }

  async connect(options?: ConnectOptions) {
    await this.mediaService.init()
    await this.connectionManager.connect(options)
  }

  async disconnect() {
    await this.connectionManager.disconnect()
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
