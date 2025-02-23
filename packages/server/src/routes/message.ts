import type { App, H3Event } from 'h3'
import type { PublicMessage } from '../types'

import { useLogger } from '@tg-search/common'
import { findMessagesByChatId } from '@tg-search/db'
import { createRouter, defineEventHandler, getQuery, getRouterParams } from 'h3'

import { createResponse } from '../utils/response'

const logger = useLogger()

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
 * Setup message routes
 */
export function setupMessageRoutes(app: App) {
  const router = createRouter()

  // Get messages in chat
  router.get('/:id', defineEventHandler(async (event: H3Event) => {
    try {
      const { id } = getRouterParams(event)
      const { limit = '50', offset = '0' } = getQuery(event)

      const { items, total } = await findMessagesByChatId(Number(id), {
        limit: Number(limit),
        offset: Number(offset),
      })

      return createResponse({
        items: items.map(toPublicMessage),
        total,
      }, undefined, {
        total,
        page: Math.floor(Number(offset) / Number(limit)) + 1,
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      })
    }
    catch (error) {
      logger.withError(error).error('Failed to get messages')
      return createResponse(undefined, error)
    }
  }))

  // Mount routes
  app.use('/messages', router.handler)
}
