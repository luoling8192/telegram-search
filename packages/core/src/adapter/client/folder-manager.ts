import type { NewFolder } from '@tg-search/db'
import type { TelegramClient } from 'telegram'
import type { Folder } from '../types'

import { useLogger } from '@tg-search/common'
import { Api } from 'telegram'

/**
 * Manages Telegram folder operations
 */
export class FolderManager {
  private logger = useLogger('folder')

  constructor(
    private readonly client: TelegramClient,
  ) {}

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
      throw error
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
      throw error
    }

    return folders
  }
}
