import type { App, H3Event } from 'h3'

import { useLogger } from '@tg-search/common'
import { findMessagesByChatId } from '@tg-search/db'
import { createRouter, defineEventHandler, getQuery, getRouterParams } from 'h3'

import { createResponse } from '../utils/response'

const logger = useLogger()

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
        items,
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
