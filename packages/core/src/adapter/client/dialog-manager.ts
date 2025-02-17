import type { NewChat } from '@tg-search/db'
import type { TelegramClient } from 'telegram'
import type { DialogsResult } from '../types'

import { useLogger } from '@tg-search/common'

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
      const dialogs = await this.client.getDialogs({
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
        const { type, name } = EntityResolver.getEntityInfo(entity)

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
      throw error
    }

    return chats
  }
}
