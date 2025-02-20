import type { PublicChat } from '../types'

import { useLogger } from '@tg-search/common'
import { findMessagesByChatId, getAllChats } from '@tg-search/db'
import { Elysia, NotFoundError, t } from 'elysia'

import { createResponse } from '../utils/response'

const logger = useLogger()

/**
 * Convert database chat to public chat
 */
function toPublicChat(chat: Awaited<ReturnType<typeof getAllChats>>[number]): PublicChat {
  return {
    id: chat.id,
    title: chat.title,
    type: chat.type,
    lastMessageDate: chat.lastMessageDate,
    messageCount: chat.messageCount,
  }
}

/**
 * Chat routes
 */
export const chatRoutes = new Elysia({ prefix: '/chats' })
  // Error handling
  .onError(({ code, error }) => {
    logger.withError(error).error(`Error handling request: ${code}`)
    return createResponse(undefined, error)
  })
  // Get all chats
  .get('/', async () => {
    const chats = await getAllChats()
    return createResponse(chats.map(toPublicChat))
  })
  // Get messages in chat
  .get('/:id/messages', async ({ params: { id }, query: { limit = '50', offset = '0' } }) => {
    // Get messages with pagination
    const messages = await findMessagesByChatId(Number(id))
    if (!messages) {
      throw new NotFoundError(`Chat ${id} not found`)
    }

    const total = messages.items.length
    const slicedMessages = messages.items
      .slice(Number(offset), Number(offset) + Number(limit))
      .map(message => ({
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
      }))

    return createResponse({
      items: slicedMessages,
      total,
    }, undefined, {
      total,
      page: Math.floor(Number(offset) / Number(limit)) + 1,
      pageSize: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    })
  }, {
    query: t.Object({
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String()),
    }),
  })
