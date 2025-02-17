import type { PublicChat } from '../types'

import { useLogger } from '@tg-search/common'
import { findMessagesByChatId, getAllChats } from '@tg-search/db'
import { Elysia, t } from 'elysia'

const logger = useLogger('chat')

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
  // Get all chats
  .get('/', async () => {
    try {
      const chats = await getAllChats()
      return chats.map(toPublicChat)
    }
    catch (error) {
      logger.withError(error).error('Failed to get chats')
      throw error
    }
  })
  // Get messages in chat
  .get('/:id/messages', async ({ params: { id }, query: { limit = '50', offset = '0' } }) => {
    try {
      // Get messages with pagination
      const messages = await findMessagesByChatId(Number(id))
      const total = messages.length
      const slicedMessages = messages
        .slice(Number(offset), Number(offset) + Number(limit))
        .map(message => ({
          id: message.id,
          chatId: message.chatId,
          date: message.createdAt,
          text: message.content || '',
          type: message.type,
          replyToMessageId: message.replyToId || undefined,
          media: message.mediaInfo
            ? {
                type: message.mediaInfo.type,
                mimeType: message.mediaInfo.mimeType,
                fileName: message.mediaInfo.fileName,
                fileSize: message.mediaInfo.fileSize,
                width: message.mediaInfo.width,
                height: message.mediaInfo.height,
                duration: message.mediaInfo.duration,
                thumbnail: message.mediaInfo.thumbnail
                  ? {
                      width: message.mediaInfo.thumbnail.width,
                      height: message.mediaInfo.thumbnail.height,
                    }
                  : undefined,
              }
            : undefined,
        }))

      return {
        total,
        items: slicedMessages,
      }
    }
    catch (error) {
      logger.withError(error).error('Failed to get messages')
      throw error
    }
  }, {
    query: t.Object({
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String()),
    }),
  })
