import type { PublicMessage } from '../types'

import { useLogger } from '@tg-search/common'
import { findMessagesByChatId } from '@tg-search/db'
import { Elysia, t } from 'elysia'

const logger = useLogger('message')

/**
 * Convert database message to public message
 */
function toPublicMessage(message: Awaited<ReturnType<typeof findMessagesByChatId>>['items'][number]): PublicMessage {
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
  .get('/:id', async ({ params: { id }, query: { limit = '50', offset = '0' } }) => {
    try {
      const { items, total } = await findMessagesByChatId(Number(id), {
        limit: Number(limit),
        offset: Number(offset),
      })

      return {
        items: items.map(toPublicMessage),
        total,
        limit: Number(limit),
        offset: Number(offset),
      }
    }
    catch (error) {
      logger.withError(error).error('Failed to get messages')
      throw error
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
    query: t.Object({
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String()),
    }),
  })
