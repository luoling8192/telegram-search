import type { DatabaseFolder } from '@tg-search/db'
import type { TelegramClient } from 'telegram'
import type { TelegramFolder } from '../../types'

import { useLogger } from '@tg-search/common'
import { Api } from 'telegram'

import { ErrorHandler } from './utils/error-handler'

/**
 * Manages Telegram folder operations
 */
export class FolderManager {
  private logger = useLogger()
  private errorHandler = new ErrorHandler()

  constructor(
    private readonly client: TelegramClient,
  ) {}

  /**
   * Convert any error to Error type
   */
  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error
    }
    return new Error(String(error))
  }

  /**
   * Get all folders from Telegram
   */
  async getFolders(): Promise<DatabaseFolder[]> {
    const folders: DatabaseFolder[] = []

    try {
      // Add default "All Chats" folder
      folders.push({
        id: 0,
        title: '全部消息',
        emoji: '📁',
        lastSyncTime: new Date(),
      } as DatabaseFolder)

      // Get custom folders from Telegram with retry
      const result = await this.errorHandler.withRetry(
        () => this.client.invoke(new Api.messages.GetDialogFilters()),
        {
          context: '获取所有文件夹',
          maxRetries: 3,
          initialDelay: 2000,
        },
      )

      if (!result.success || !result.data) {
        throw new Error('获取文件夹失败')
      }

      const folderData = result.data

      this.logger.withFields({
        type: typeof folderData,
        className: folderData?.className,
        filtersLength: folderData?.filters?.length,
      }).debug('获取到文件夹原始数据')

      // Convert to our format
      if (folderData?.filters) {
        for (const folder of folderData.filters) {
          try {
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
              } as DatabaseFolder)
            }
          }
          catch (error) {
            // Log error but continue with next folder
            this.errorHandler.handleError(
              this.toError(error),
              '处理文件夹数据',
              `处理文件夹 ${('id' in folder ? folder.id : '未知')} 时出错，跳过该文件夹`,
            )
          }
        }
      }

      this.logger.debug(`获取到 ${folders.length} 个文件夹`)
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '获取所有文件夹', '获取文件夹列表失败')
      throw error
    }

    return folders
  }

  /**
   * Get folders for a specific chat
   */
  async getFoldersForChat(chatId: number): Promise<TelegramFolder[]> {
    const folders: TelegramFolder[] = []

    try {
      // Get dialog entity with retry
      const entityResponse = await this.errorHandler.withRetry(
        () => this.client.getEntity(chatId),
        {
          context: '获取聊天实体',
          maxRetries: 3,
          initialDelay: 2000,
        },
      )

      if (!entityResponse.success || !entityResponse.data) {
        this.logger.warn(`未找到ID为 ${chatId} 的聊天`)
        return folders
      }

      // Get all folders with retry
      const folderResponse = await this.errorHandler.withRetry(
        () => this.client.invoke(new Api.messages.GetDialogFilters()),
        {
          context: '获取文件夹列表',
          maxRetries: 3,
          initialDelay: 2000,
        },
      )

      if (!folderResponse.success || !folderResponse.data) {
        throw new Error('获取文件夹失败')
      }

      const result = folderResponse.data

      this.logger.withFields({
        type: typeof result,
        className: result?.className,
        filtersLength: result?.filters?.length,
      }).debug('获取到文件夹原始数据')

      // Convert to our format and check if chat in each folder
      if (result?.filters) {
        for (const folder of result.filters) {
          try {
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
                  // Remove customId since it's not in the Folder type
                })
              }
            }
          }
          catch (error) {
            // Log error but continue with next folder
            this.errorHandler.handleError(
              this.toError(error),
              '处理文件夹数据',
              `处理文件夹 ${('id' in folder ? folder.id : '未知')} 时出错，跳过该文件夹`,
            )
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
      this.errorHandler.handleError(this.toError(error), '获取聊天的文件夹', `获取聊天 ${chatId} 的文件夹失败`)
      throw error
    }

    return folders
  }
}
