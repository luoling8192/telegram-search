import type { MessageCreateInput } from './types'

import { useDB, useLogger } from '@tg-search/common'

import { createChatPartition, createMessageContentTable } from '../../schema'
import { refreshMessageStats } from './stats'

const logger = useLogger()

/**
 * Create new messages in a partition table
 */
export async function createMessage(data: MessageCreateInput | MessageCreateInput[]): Promise<void> {
  const messageArray = Array.isArray(data) ? data : [data]

  try {
    // Create partition tables if not exist
    const chatIds = [...new Set(messageArray.map(msg => msg.chatId))]
    for (const chatId of chatIds) {
      // Create partition table and materialized view
      await useDB().execute(createChatPartition(chatId))
    }

    // Insert messages into partition tables
    await Promise.all(
      chatIds.map(async (chatId) => {
        const chatMessages = messageArray.filter(msg => msg.chatId === chatId)
        const contentTable = createMessageContentTable(chatId)

        // Insert into partition table with upsert
        await useDB().insert(contentTable).values(
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
          target: [contentTable.id, contentTable.chatId],
        })

        // Refresh materialized view
        await refreshMessageStats(chatId)
      }),
    )

    logger.debug(`已保存 ${messageArray.length} 条消息`)
  }
  catch (error) {
    logger.withError(error).error('保存消息失败')
    throw error
  }
}
