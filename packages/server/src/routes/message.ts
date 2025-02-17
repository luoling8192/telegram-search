import type { PublicMessage } from '../types'

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
    mediaInfo: message.mediaInfo,
    fromId: message.fromId,
    fromName: message.fromName,
    fromAvatar: message.fromAvatar,
    replyToId: message.replyToId,
    forwardFromChatId: message.forwardFromChatId,
    forwardFromChatName: message.forwardFromChatName,
    forwardFromMessageId: message.forwardFromMessageId,
    views: message.views,
    forwards: message.forwards,
    links: message.links,
    metadata: message.metadata,
    createdAt: message.createdAt,
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
