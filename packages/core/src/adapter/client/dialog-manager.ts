import type { DatabaseNewChat } from '@tg-search/db'
import type { TelegramClient } from 'telegram'
import type { TelegramChat, TelegramChatsResult } from '../../types'

import { useLogger } from '@tg-search/common'

import { EntityResolver } from './utils/entity-resolver'
import { ErrorHandler } from './utils/error-handler'

/**
 * Manages Telegram dialogs (chats) operations
 */
export class DialogManager {
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
   * Get all dialogs (chats) with pagination
   */
  async getPaginationDialogs(offset = 0, limit = 10): Promise<TelegramChatsResult> {
    try {
      // Get dialogs with pagination using retry logic
      const apiResponse = await this.errorHandler.withRetry(
        () => this.client.getDialogs({
          limit: limit + 1, // Get one extra to check if there are more
          offsetDate: undefined,
          offsetId: offset,
          offsetPeer: undefined,
          ignorePinned: false,
        }),
        {
          context: '获取分页对话列表',
          maxRetries: 3,
          initialDelay: 2000,
        },
      )

      if (!apiResponse.success || !apiResponse.data) {
        throw new Error('获取对话列表失败')
      }

      const dialogs = apiResponse.data
      const hasMore = dialogs.length > limit
      const dialogsToReturn = hasMore ? dialogs.slice(0, limit) : dialogs

      // Convert dialogs to our format
      const convertedDialogs = dialogsToReturn.map((dialog) => {
        const entity = dialog.entity
        const { type, name } = EntityResolver.getEntityInfo(entity)

        return {
          id: entity?.id.toJSNumber() || 0,
          title: name,
          type,
          unreadCount: dialog.unreadCount,
          lastMessage: dialog.message?.message,
          lastMessageDate: dialog.message?.date ? new Date(dialog.message.date * 1000) : undefined,
        }
      })

      return {
        chats: convertedDialogs as TelegramChat[],
        total: dialogs.length,
      }
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '获取分页对话列表', '无法获取分页对话列表')
      throw error
    }
  }

  /**
   * Get all chats from Telegram
   */
  async getDialogs(): Promise<DatabaseNewChat[]> {
    const chats: DatabaseNewChat[] = []

    try {
      // Get all dialogs with retry logic
      const apiResponse = await this.errorHandler.withRetry(
        () => this.client.getDialogs({
          offsetDate: undefined,
          offsetId: 0,
          offsetPeer: undefined,
          ignorePinned: false,
        }),
        {
          context: '获取所有对话',
          maxRetries: 3,
          initialDelay: 2000,
        },
      )

      if (!apiResponse.success || !apiResponse.data) {
        throw new Error('获取对话列表失败')
      }

      const dialogs = apiResponse.data
      this.logger.debug(`获取到 ${dialogs.length} 个会话`)

      // Convert to our format
      for (const dialog of dialogs) {
        try {
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
        catch (error) {
          // Log error but continue with next dialog
          this.errorHandler.handleError(
            this.toError(error),
            '处理对话数据',
            `处理对话 ${dialog.entity?.id?.toString() || '未知'} 时出错，跳过该对话`,
          )
        }
      }

      this.logger.debug(`处理完成，共 ${chats.length} 个会话`)
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '获取所有对话', '获取对话列表失败')
      throw error
    }

    return chats
  }
}
