import type { PublicMessage } from '../types'
import type { MessageType } from '@tg-search/db/schema/types'

import { useLogger } from '@tg-search/common'
import { findMessagesByChatId } from '@tg-search/db'
import { Elysia, t } from 'elysia'

const logger = useLogger('message')

/**
 * Convert database message to public message
 */
function toPublicMessage(message: Awaited<ReturnType<typeof findMessagesByChatId>>[number]): PublicMessage {
  return {
    id: message.id,
    chatId: message.chatId,
    type: message.type,
    content: message.content,
    mediaInfo: message.mediaInfo || null,
    createdAt: message.createdAt,
    fromId: message.fromId,
    replyToId: message.replyToId,
    forwardFromChatId: message.forwardFromChatId,
    forwardFromMessageId: message.forwardFromMessageId,
    views: message.views,
    forwards: message.forwards,
  }
}

/**
 * Message routes
 */
export const messageRoutes = new Elysia({ prefix: '/messages' })
  // Get messages in chat
  .get('/:id', async ({ params: { id } }) => {
    try {
      const messages = await findMessagesByChatId(Number(id))
      return messages.map(toPublicMessage)
    }
    catch (error) {
      logger.withError(error).error('Failed to get messages')
      throw error
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
  })
