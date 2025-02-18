import type { NewChat } from '@tg-search/db'
import type { TelegramClient } from 'telegram'
import type { DialogsResult } from '../types'

import { useLogger } from '@tg-search/common'
import { Api } from 'telegram'

import { EntityResolver } from './entity-resolver'

/**
 * Manages Telegram dialogs (chats) operations
 */
export class DialogManager {
  private logger = useLogger('dialog')

  constructor(
    private readonly client: TelegramClient,
  ) {}

  /**
   * Get all dialogs (chats) with pagination
   */
  async getDialogs(offset = 0, limit = 10): Promise<DialogsResult> {
    // Get dialogs with pagination
    const dialogs = await this.client.getDialogs({
      limit: limit + 1, // Get one extra to check if there are more
      offsetDate: undefined,
      offsetId: offset,
      offsetPeer: undefined,
      ignorePinned: false,
    })

    const hasMore = dialogs.length > limit
    const dialogsToReturn = hasMore ? dialogs.slice(0, limit) : dialogs

    // Convert dialogs to our format
    const convertedDialogs = dialogsToReturn.map((dialog) => {
      const entity = dialog.entity
      const { type, name } = EntityResolver.getEntityInfo(entity)

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
   * Get all chats from Telegram
   */
  async getChats(): Promise<NewChat[]> {
    const chats: NewChat[] = []

    try {
      // Get all dialogs first
      this.logger.debug('正在获取会话列表...')
      const dialogs = await this.client.getDialogs({
        offsetDate: undefined,
        offsetId: 0,
        offsetPeer: undefined,
        ignorePinned: false,
      })
      this.logger.debug(`获取到 ${dialogs.length} 个会话`)

      // Get all folders first
      this.logger.debug('正在获取文件夹列表...')
      const result = await this.client.invoke(new Api.messages.GetDialogFilters())
      const folders = result?.filters || []
      this.logger.debug(`获取到 ${folders.length} 个文件夹`)

      // Process in batches
      const batchSize = 50
      for (let i = 0; i < dialogs.length; i += batchSize) {
        const batch = dialogs.slice(i, Math.min(i + batchSize, dialogs.length))
        this.logger.debug(`正在处理第 ${i + 1} 到 ${i + batch.length} 个会话...`)

        // Convert to our format
        for (const dialog of batch) {
          const entity = dialog.entity
          if (!entity)
            continue

          // Get entity info for type and name
          const { type, name } = EntityResolver.getEntityInfo(entity)

          // Extract message count from participantsCount if available
          const messageCount = 'participantsCount' in entity
            ? entity.participantsCount || 0
            : 0

          // Find folder for this chat
          let folderId: number | null = 0  // 默认在"所有会话"文件夹中
          for (const folder of folders) {
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
                  return peer.channelId.toJSNumber() === entity.id.toJSNumber()
                if (peer instanceof Api.InputPeerChat)
                  return peer.chatId.toJSNumber() === entity.id.toJSNumber()
                if (peer instanceof Api.InputPeerUser)
                  return peer.userId.toJSNumber() === entity.id.toJSNumber()
                return false
              })

              const isExcluded = excludedPeers.some((peer: Api.TypeInputPeer) => {
                if (peer instanceof Api.InputPeerChannel)
                  return peer.channelId.toJSNumber() === entity.id.toJSNumber()
                if (peer instanceof Api.InputPeerChat)
                  return peer.chatId.toJSNumber() === entity.id.toJSNumber()
                if (peer instanceof Api.InputPeerUser)
                  return peer.userId.toJSNumber() === entity.id.toJSNumber()
                return false
              })

              // If chat is in this folder, set folder ID
              if (isIncluded && !isExcluded) {
                folderId = ('id' in folder ? folder.id : 0) + 1 // Add 1 to avoid conflict with default folder
                break
              }
            }
          }

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
            folderId,
          })

          // Log progress for each chat
          this.logger.debug(`处理会话: [${type}] ${name}${folderId ? ` (文件夹 ID: ${folderId})` : ''}`)
        }
      }

      this.logger.debug(`处理完成，共 ${chats.length} 个会话`)
    }
    catch (error) {
      this.logger.withError(error).error('获取会话失败')
      throw error
    }

    return chats
  }
}
