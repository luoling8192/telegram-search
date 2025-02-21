import type { MessageCreateInput } from './types'

import { useDB, useLogger } from '@tg-search/common'

import { createMessageStatsView, getMessageTable, useMessageTable } from '../../schema'
import { refreshMessageStats } from './stats'

const logger = useLogger()

/**
 * Create new messages in a partition table
 */
export async function createMessages(data: MessageCreateInput | MessageCreateInput[]): Promise<void> {
  const messageArray = Array.isArray(data) ? data : [data]

  try {
    // Create message tables if not exist
    const chatIds = [...new Set(messageArray.map(msg => msg.chatId))]

    // Insert messages into message tables
    for (const chatId of chatIds) {
      const chatMessages = messageArray.filter(msg => msg.chatId === chatId)
      const messageTable = getMessageTable(chatId)

      try {
        // Create table and indexes
        await useMessageTable(chatId)
        // Create materialized view for stats
        await createMessageStatsView(chatId)
      }
      catch (error) {
        logger.withError(error).error('创建消息表失败')
        throw error
      }

      // Insert into message table with upsert
      await useDB().insert(messageTable).values(
        chatMessages.map(msg => ({
          id: msg.id,
          chatId: msg.chatId,
          type: msg.type || 'text',
          content: msg.content || null,
          embedding: null,
          mediaInfo: msg.mediaInfo || null,
          createdAt: msg.createdAt,
          fromId: msg.fromId || null,
          fromName: msg.fromName || null,
          fromAvatar: msg.fromAvatar || null,
          replyToId: msg.replyToId || null,
          forwardFromChatId: msg.forwardFromChatId || null,
          forwardFromChatName: msg.forwardFromChatName || null,
          forwardFromMessageId: msg.forwardFromMessageId || null,
          views: msg.views || null,
          forwards: msg.forwards || null,
          metadata: msg.metadata || null,
          links: msg.links || null,
        })),
      ).onConflictDoNothing({
        target: [messageTable.id],
      })

      try {
        // Refresh materialized view
        await refreshMessageStats(chatId)
      }
      catch (error) {
        logger.withError(error).error('刷新消息统计失败')
        throw error
      }
    }

    logger.debug(`已保存 ${messageArray.length} 条消息`)
  }
  catch (error) {
    logger.withError(error).error('保存消息失败')
    throw error
  }
}
