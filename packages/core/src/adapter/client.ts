import type { NewChat, NewFolder } from '@tg-search/db'
import type { Entity } from 'telegram/define'
import type { ConnectOptions, DialogsResult, Folder, ITelegramClientAdapter, MessageOptions, TelegramMessage, TelegramMessageType } from './types'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getConfig, useLogger } from '@tg-search/common'
import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'

import { MediaService } from '../services/media'

interface ClientAdapterConfig {
  apiId: number
  apiHash: string
  phoneNumber: string
  password?: string
  systemVersion?: string
}

export class ClientAdapter implements ITelegramClientAdapter {
  private client: TelegramClient
  private messageCallback?: (message: TelegramMessage) => Promise<void>
  private config: ClientAdapterConfig
  private sessionFile: string
  private session: StringSession
  private mediaService: MediaService
  private logger = useLogger('client')

  constructor(config: ClientAdapterConfig) {
    this.config = {
      systemVersion: 'Unknown',
      ...config,
    }
    const appConfig = getConfig()
    this.sessionFile = appConfig.sessionPath

    // Create client with session
    this.session = new StringSession('')
    this.client = new TelegramClient(
      this.session,
      this.config.apiId,
      this.config.apiHash,
      { connectionRetries: 5 },
    )
    this.mediaService = new MediaService(this.client)
  }

  get type() {
    return 'client' as const
  }

  /**
   * Load session string from file
   */
  private async loadSession(): Promise<string> {
    try {
      await fs.mkdir(path.dirname(this.sessionFile), { recursive: true })
      return await fs.readFile(this.sessionFile, 'utf-8')
    }
    catch {
      return ''
    }
  }

  /**
   * Save session string to file
   */
  private async saveSession(session: string) {
    await fs.mkdir(path.dirname(this.sessionFile), { recursive: true })
    await fs.writeFile(this.sessionFile, session, 'utf-8')
  }

  /**
   * Get entity type and name
   */
  private getEntityInfo(entity: Entity | undefined): { type: 'user' | 'group' | 'channel', name: string } {
    if (!entity) {
      return { type: 'user', name: 'Unknown' }
    }

    if (entity instanceof Api.User) {
      return {
        type: 'user',
        name: [entity.firstName, entity.lastName].filter(Boolean).join(' ')
          || entity.username
          || 'Unknown User',
      }
    }

    if (entity instanceof Api.Chat || entity instanceof Api.Channel) {
      return {
        type: entity instanceof Api.Channel
          ? (entity.megagroup ? 'group' : 'channel')
          : 'group',
        name: entity.title,
      }
    }

    return { type: 'user', name: 'Unknown' }
  }

  /**
   * Get all dialogs (chats) with pagination
   */
  async getDialogs(_offset = 0, limit = 10): Promise<DialogsResult> {
    // Get all dialogs first
    const dialogs = await this.client.getDialogs({
      limit: limit + 1, // Get one extra to check if there are more
      offsetDate: undefined,
      offsetId: 0,
      offsetPeer: undefined,
      ignorePinned: false,
    })

    const hasMore = dialogs.length > limit
    const dialogsToReturn = hasMore ? dialogs.slice(0, limit) : dialogs

    // Convert dialogs to our format, handle Saved Messages specially
    const convertedDialogs = dialogsToReturn.map((dialog) => {
      const entity = dialog.entity
      const { type, name } = this.getEntityInfo(entity)

      return {
        id: entity?.id.toJSNumber() || 0,
        name,
        type,
        unreadCount: dialog.unreadCount,
        lastMessage: dialog.message?.message,
        lastMessageDate: dialog.message?.date ? new Date(dialog.message.date * 1000) : undefined,
      }
    })

    return {
      dialogs: convertedDialogs,
      total: dialogs.length,
    }
  }

  /**
   * Convert message type from Telegram to our type
   */
  private getMessageType(message: Api.Message): TelegramMessageType {
    if (message.media) {
      if ('photo' in message.media)
        return 'photo'
      if ('document' in message.media)
        return 'document'
      if ('video' in message.media)
        return 'video'
      if ('sticker' in message.media)
        return 'sticker'
      return 'other'
    }
    if (message.message)
      return 'text'
    return 'other'
  }

  /**
   * Convert message from Telegram to our format
   */
  private async convertMessage(message: Api.Message, skipMedia = false): Promise<TelegramMessage> {
    const type = this.getMessageType(message)
    let mediaInfo

    if (message.media && !skipMedia) {
      const downloadedMediaInfo = this.mediaService.getMediaInfo(message)
      if (downloadedMediaInfo) {
        const localPath = await this.mediaService.downloadMedia(
          message,
          downloadedMediaInfo,
        )
        if (localPath) {
          downloadedMediaInfo.localPath = localPath
        }
        mediaInfo = downloadedMediaInfo
      }
    }

    return {
      id: message.id,
      chatId: this.getPeerId(message.peerId),
      type,
      content: message.message,
      mediaInfo,
      fromId: (message.fromId instanceof Api.PeerUser) ? message.fromId.userId.toJSNumber() : undefined,
      replyToId: message.replyTo?.replyToMsgId,
      forwardFromChatId: (message.fwdFrom?.fromId instanceof Api.PeerChannel)
        ? message.fwdFrom.fromId.channelId.toJSNumber()
        : undefined,
      forwardFromMessageId: message.fwdFrom?.channelPost,
      views: message.views,
      forwards: message.forwards,
      createdAt: new Date(message.date * 1000),
    }
  }

  async connect(options?: ConnectOptions) {
    try {
      await this.mediaService.init()
      const session = await this.loadSession()

      if (session) {
        this.session = new StringSession(session)
        this.client.session = this.session
      }

      await this.client.connect()

      if (!await this.client.isUserAuthorized()) {
        const code = options?.code || ''
        await this.client.signInUser(
          {
            apiId: this.config.apiId,
            apiHash: this.config.apiHash,
          },
          {
            phoneNumber: this.config.phoneNumber,
            phoneCode: async () => code,
            password: async () => options?.password || this.config.password || '',
            onError: (err: Error) => {
              this.logger.withError(err).error('登录失败')
              throw err
            },
          },
        )
      }

      const sessionString = await this.client.session.save() as unknown as string
      await this.saveSession(sessionString)
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

  async *getMessages(chatId: number, _limit = 100, options?: MessageOptions): AsyncGenerator<TelegramMessage> {
    let offsetId = 0
    let hasMore = true
    let processedCount = 0

    while (hasMore) {
      // 获取一批消息
      const messages = await this.client.getMessages(chatId, {
        limit: 100, // 每次获取100条
        offsetId, // 从上一批的最后一条消息开始
        minId: 0, // 从最早的消息开始
      })

      // 如果获取的消息数小于请求的数量，说明没有更多消息了
      hasMore = messages.length === 100

      for (const message of messages) {
        // 检查时间范围
        const messageTime = new Date(message.date * 1000)
        if (options?.startTime && messageTime < options.startTime) {
          continue
        }
        if (options?.endTime && messageTime > options.endTime) {
          continue
        }

        // 如果是媒体消息，只获取基本信息而不下载文件
        const converted = await this.convertMessage(message, options?.skipMedia)

        // 检查消息类型
        if (options?.messageTypes && !options.messageTypes.includes(converted.type)) {
          continue
        }

        yield converted
        processedCount++

        // 更新 offsetId 为当前消息的 ID
        offsetId = message.id

        // 检查是否达到限制
        if (options?.limit && processedCount >= options.limit) {
          return
        }
      }
    }
  }

  onMessage(callback: (message: TelegramMessage) => Promise<void>) {
    this.messageCallback = callback
  }

  /**
   * Get all folders from Telegram
   */
  async getFolders(): Promise<NewFolder[]> {
    const folders: NewFolder[] = []

    try {
      // Add default "All Chats" folder
      folders.push({
        id: 0,
        title: '全部消息',
        emoji: '📁',
        lastSyncTime: new Date(),
      })

      // Get custom folders from Telegram
      const result = await this.client.invoke(new Api.messages.GetDialogFilters())
      this.logger.withFields({
        type: typeof result,
        className: result?.className,
        filtersLength: result?.filters?.length,
      }).debug('获取到文件夹原始数据')

      // Convert to our format
      if (result?.filters) {
        for (const folder of result.filters) {
          this.logger.withFields({
            className: folder?.className,
            id: 'id' in folder ? folder.id : undefined,
            title: 'title' in folder ? folder.title?.text : undefined,
            emoticon: 'emoticon' in folder ? folder.emoticon : undefined,
          }).debug('处理文件夹')

          // Skip default folder
          if (folder.className === 'DialogFilterDefault') {
            continue
          }

          // Only process custom folders
          if (folder.className === 'DialogFilter' || folder.className === 'DialogFilterChatlist') {
            // Extract folder information
            const id = ('id' in folder ? folder.id : 0) + 1 // Add 1 to avoid conflict with default folder
            const title = ('title' in folder ? folder.title?.text : '') || ''
            const emoji = ('emoticon' in folder ? folder.emoticon : null) || null

            folders.push({
              id,
              title,
              emoji,
              lastSyncTime: new Date(),
            })
          }
        }
      }

      this.logger.debug(`获取到 ${folders.length} 个文件夹`)
    }
    catch (error) {
      this.logger.withError(error).error('获取文件夹失败')
      throw error // Re-throw to let caller handle the error
    }

    return folders
  }

  /**
   * Get folders for a specific chat
   */
  async getFoldersForChat(chatId: number): Promise<Folder[]> {
    const folders: Folder[] = []

    try {
      // Get dialog entity
      const dialog = await this.client.getEntity(chatId)
      if (!dialog)
        return folders

      // Get all folders
      const result = await this.client.invoke(new Api.messages.GetDialogFilters())
      this.logger.withFields({
        type: typeof result,
        className: result?.className,
        filtersLength: result?.filters?.length,
      }).debug('获取到文件夹原始数据')

      // Convert to our format and check if chat in each folder
      if (result?.filters) {
        for (const folder of result.filters) {
          // Skip default folder
          if (folder.className === 'DialogFilterDefault') {
            continue
          }

          // Only process custom folders
          if (folder.className === 'DialogFilter' || folder.className === 'DialogFilterChatlist') {
            const includedPeers = ('includePeers' in folder ? folder.includePeers : []) || []
            const excludedPeers = ('excludePeers' in folder ? folder.excludePeers : []) || []

            // Check if chat is in this folder
            const isIncluded = includedPeers.some((peer: Api.TypeInputPeer) => {
              if (peer instanceof Api.InputPeerChannel)
                return peer.channelId.toJSNumber() === chatId
              if (peer instanceof Api.InputPeerChat)
                return peer.chatId.toJSNumber() === chatId
              if (peer instanceof Api.InputPeerUser)
                return peer.userId.toJSNumber() === chatId
              return false
            })

            const isExcluded = excludedPeers.some((peer: Api.TypeInputPeer) => {
              if (peer instanceof Api.InputPeerChannel)
                return peer.channelId.toJSNumber() === chatId
              if (peer instanceof Api.InputPeerChat)
                return peer.chatId.toJSNumber() === chatId
              if (peer instanceof Api.InputPeerUser)
                return peer.userId.toJSNumber() === chatId
              return false
            })

            // Only add folder if chat is included and not excluded
            if (isIncluded && !isExcluded) {
              folders.push({
                id: ('id' in folder ? folder.id : 0) + 1, // Add 1 to avoid conflict with default folder
                title: ('title' in folder ? folder.title?.toString() : '') || '',
                customId: 'id' in folder ? folder.id : undefined,
              })
            }
          }
        }
      }

      // Add default folder
      folders.unshift({
        id: 0,
        title: '全部消息',
      })

      this.logger.debug(`获取到 ${folders.length} 个文件夹`)
    }
    catch (error) {
      this.logger.withError(error).error('获取文件夹失败')
      throw error // Re-throw to let caller handle the error
    }

    return folders
  }

  /**
   * Get all chats from Telegram
   */
  async getChats(): Promise<NewChat[]> {
    const chats: NewChat[] = []

    try {
      // Get all dialogs first
      const dialogs = await this.client.getDialogs({
        // limit: 100,
        offsetDate: undefined,
        offsetId: 0,
        offsetPeer: undefined,
        ignorePinned: false,
      })

      this.logger.debug(`获取到 ${dialogs.length} 个会话`)

      // Convert to our format
      for (const dialog of dialogs) {
        const entity = dialog.entity
        if (!entity)
          continue

        // Get entity info for type and name
        const { type, name } = this.getEntityInfo(entity)

        // Extract message count from participantsCount if available
        const messageCount = 'participantsCount' in entity
          ? entity.participantsCount || 0
          : 0

        // Create chat object with entity data
        chats.push({
          id: entity.id.toJSNumber(),
          title: name,
          type,
          lastMessage: dialog.message?.message || null,
          lastMessageDate: dialog.message?.date
            ? new Date(dialog.message.date * 1000)
            : null,
          lastSyncTime: new Date(),
          messageCount,
          folderId: null, // Will be updated later
        })
      }

      this.logger.debug(`处理完成，共 ${chats.length} 个会话`)
    }
    catch (error) {
      this.logger.withError(error).error('获取会话失败')
    }

    return chats
  }

  /**
   * Get chat type from Telegram chat object
   */
  private getChatType(chat: any): 'user' | 'group' | 'channel' | 'saved' {
    if (chat.className === 'Channel') {
      return chat.megagroup ? 'group' : 'channel'
    }
    if (chat.className === 'Chat') {
      return 'group'
    }
    if (chat.className === 'User') {
      return 'self' in chat && chat.self ? 'saved' : 'user'
    }
    return 'group'
  }

  // 辅助方法：获取 Peer ID
  private getPeerId(peer: Api.TypePeer): number {
    if (peer instanceof Api.PeerUser)
      return peer.userId.toJSNumber()
    if (peer instanceof Api.PeerChat)
      return peer.chatId.toJSNumber()
    if (peer instanceof Api.PeerChannel)
      return peer.channelId.toJSNumber()
    return 0
  }
}
