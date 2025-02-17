import type { NewChat, NewFolder } from '@tg-search/db'
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
    this.config = config
    const appConfig = getConfig()
    this.sessionFile = appConfig.sessionPath

    // Create client with session
    this.session = new StringSession('')
    this.client = new TelegramClient(
      this.session,
      config.apiId,
      config.apiHash,
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
  private getEntityInfo(entity: any): { type: 'user' | 'group' | 'channel', name: string } {
    // 检查是否是用户
    if ('firstName' in entity || 'lastName' in entity || ('username' in entity && !('title' in entity))) {
      return {
        type: 'user',
        name: [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.username || 'Unknown User',
      }
    }

    // 检查是否是群组或频道
    if ('title' in entity) {
      // 检查是否是超级群组
      if ('megagroup' in entity && entity.megagroup) {
        return { type: 'group', name: entity.title }
      }
      // 检查是否是普通群组
      if ('participantsCount' in entity || entity.className === 'Chat') {
        return { type: 'group', name: entity.title }
      }
      // 其他情况认为是频道
      return { type: 'channel', name: entity.title }
    }

    // 默认情况
    return {
      type: 'user',
      name: 'Unknown',
    }
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

    // Get current user for Saved Messages
    const me = await this.client.getMe()

    // Convert dialogs to our format, handle Saved Messages specially
    const convertedDialogs = dialogsToReturn.map((dialog) => {
      const entity = dialog.entity
      const { type, name } = this.getEntityInfo(entity)

      // If this is the current user (Saved Messages), mark it as saved type
      if (entity?.id?.toJSNumber() === me?.id?.toJSNumber()) {
        return {
          id: entity.id.toJSNumber(),
          name: '常用',
          type: 'saved' as const,
          unreadCount: dialog.unreadCount,
          lastMessage: dialog.message?.message,
          lastMessageDate: dialog.message?.date ? new Date(dialog.message.date * 1000) : undefined,
        }
      }

      return {
        id: entity?.id.toJSNumber() || 0,
        name,
        type,
        unreadCount: dialog.unreadCount,
        lastMessage: dialog.message?.message,
        lastMessageDate: dialog.message?.date ? new Date(dialog.message.date * 1000) : undefined,
      }
    })

    // If Saved Messages is not in the list, add it at the beginning
    const hasSavedMessages = convertedDialogs.some(d => d.type === 'saved')
    if (!hasSavedMessages) {
      convertedDialogs.unshift({
        id: me.id.toJSNumber(),
        name: '常用',
        type: 'saved' as const,
        unreadCount: 0,
        lastMessage: undefined,
        lastMessageDate: undefined,
      })
    }

    return {
      dialogs: convertedDialogs,
      total: dialogs.length + (hasSavedMessages ? 0 : 1), // Add 1 to total if we added Saved Messages
    }
  }

  /**
   * Convert message type from Telegram to our type
   */
  private getMessageType(message: any): TelegramMessageType {
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
  private async convertMessage(message: any, skipMedia = false): Promise<TelegramMessage> {
    const type = this.getMessageType(message)
    let mediaInfo

    // Handle media files
    if (message.media && !skipMedia) {
      mediaInfo = this.mediaService.getMediaInfo(message)
      if (mediaInfo) {
        // Download media file
        const localPath = await this.mediaService.downloadMedia(message, mediaInfo)
        if (localPath) {
          mediaInfo.localPath = localPath
        }
      }
    }
    else if (message.media) {
      // 如果跳过媒体下载，只获取基本信息
      mediaInfo = this.mediaService.getMediaInfo(message)
    }

    return {
      id: message.id,
      chatId: message.chatId?.value || message.peerId?.channelId?.value || message.peerId?.chatId?.value || message.peerId?.userId?.value,
      type,
      content: message.message,
      mediaInfo,
      fromId: message.fromId?.userId?.value,
      replyToId: message.replyTo?.replyToMsgId,
      forwardFromChatId: message.fwdFrom?.fromId?.channelId?.value,
      forwardFromMessageId: message.fwdFrom?.channelPost,
      views: message.views,
      forwards: message.forwards,
      createdAt: new Date(message.date * 1000),
    }
  }

  async connect(options?: ConnectOptions) {
    // Initialize media service
    await this.mediaService.init()

    try {
      // Load session from file
      const session = await this.loadSession()
      if (session) {
        this.session = new StringSession(session)
        this.client.session = this.session
      }

      // Connect to Telegram
      await this.client.connect()

      // Check if we need to sign in
      if (!await this.client.isUserAuthorized()) {
        // Send code request
        await this.client.invoke(new Api.auth.SendCode({
          phoneNumber: this.config.phoneNumber,
          apiId: this.config.apiId,
          apiHash: this.config.apiHash,
          settings: new Api.CodeSettings({
            allowFlashcall: false,
            currentNumber: true,
            allowAppHash: true,
          }),
        }))

        // Wait for code
        if (!options?.code) {
          throw new Error('Code is required')
        }

        try {
          // Sign in with code
          await this.client.start({
            phoneNumber: async () => this.config.phoneNumber,
            password: async () => {
              if (!options?.password && !this.config.password) {
                throw new Error('2FA password is required')
              }
              return options?.password || this.config.password || ''
            },
            phoneCode: async () => options.code || '',
            onError: (err) => {
              this.logger.withError(err).error('登录失败')
              throw err
            },
          })
        }
        catch (error) {
          this.logger.withError(error).error('登录失败')
          throw error
        }
      }

      // Save session
      const sessionString = this.client.session.save() as unknown as string
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
   * Get folders from a dialog
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

      // Convert to our format
      if (Array.isArray(result)) {
        for (const folder of result) {
          if (folder.className === 'DialogFilter') {
            folders.push({
              id: folder.id,
              title: folder.title,
              customId: folder.id,
            })
          }
        }
      }

      // Add default folder
      folders.unshift({
        id: 0,
        title: '全部消息',
      })

      // Add saved messages folder
      const currentUser = await this.client.getMe()
      if (dialog.id.eq(currentUser.id)) {
        folders.push({
          id: -1,
          title: '常用消息',
        })
      }
    }
    catch (error) {
      this.logger.withError(error).error('获取文件夹失败:')
    }

    return folders
  }

  /**
   * Get all folders from Telegram
   */
  async getFolders(): Promise<NewFolder[]> {
    const folders: NewFolder[] = []

    try {
      // Add default folder
      folders.push({
        id: 0,
        title: '全部消息',
        emoji: '📁',
        lastSyncTime: new Date(),
      })

      // Get custom folders from Telegram
      const result = await this.client.invoke(new Api.messages.GetDialogFilters())
      const customFolders = Array.isArray(result) ? result : []

      // Convert to our format
      for (const folder of customFolders) {
        if (folder.className === 'DialogFilter') {
          folders.push({
            id: folder.id + 1, // Add 1 to avoid conflict with default folder
            title: folder.title,
            emoji: folder.emoticon || null,
            lastSyncTime: new Date(),
          })
        }
      }

      // Add saved messages folder
      // const me = await this.client.getMe()
      folders.push({
        id: -1,
        title: '常用消息',
        emoji: '📌',
        lastSyncTime: new Date(),
      })

      this.logger.debug(`获取到 ${folders.length} 个文件夹`)
    }
    catch (error) {
      this.logger.withError(error).error('获取文件夹失败')
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
        limit: 100,
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

        const { type, name } = this.getEntityInfo(entity)
        chats.push({
          id: entity.id.toJSNumber(),
          title: name,
          type,
          lastMessage: dialog.message?.message || null,
          lastMessageDate: dialog.message?.date ? new Date(dialog.message.date * 1000) : null,
          lastSyncTime: new Date(),
          messageCount: 'participantsCount' in entity ? entity.participantsCount || 0 : 0,
          folderId: null, // Will be updated later
        })
      }

      // Add Saved Messages
      const currentUser = await this.client.getMe()
      if (!chats.some(chat => chat.id === currentUser.id.toJSNumber())) {
        chats.unshift({
          id: currentUser.id.toJSNumber(),
          title: '常用',
          type: 'saved',
          lastMessage: null,
          lastMessageDate: null,
          lastSyncTime: new Date(),
          messageCount: 0,
          folderId: null,
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
}
