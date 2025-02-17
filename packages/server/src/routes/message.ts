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
