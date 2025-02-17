import type { SearchRequest, SearchResponse } from '../types'

import { useLogger } from '@tg-search/common'
import { getAllChats, getChatsInFolder } from '@tg-search/db'
import { Elysia, t } from 'elysia'

const logger = useLogger('search')

/**
 * Search routes
 */
export const searchRoutes = new Elysia({ prefix: '/search' })
  .post('/', async ({ body }) => {
    const { folderId, chatId } = body as SearchRequest

    try {
      // Get chats to search in
      let _chats = []
      if (chatId) {
        // Search in specific chat
        const chat = await getAllChats()
        _chats = chat.filter(c => c.id === chatId)
      }
      else if (folderId) {
        // Search in folder
        _chats = await getChatsInFolder(folderId)
      }
      else {
        // Search in all chats
        _chats = await getAllChats()
      }

      // TODO: Implement actual search logic
      // For now, just return empty result
      const response: SearchResponse = {
        total: 0,
        items: [],
      }

      return response
    }
    catch (error) {
      logger.withError(error).error('Failed to search messages')
      throw error
    }
  }, {
    body: t.Object({
      query: t.String(),
      folderId: t.Optional(t.Number()),
      chatId: t.Optional(t.Number()),
      limit: t.Optional(t.Number()),
      offset: t.Optional(t.Number()),
    }),
  })
