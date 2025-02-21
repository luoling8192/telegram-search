import type { SearchRequest, SearchResultItem } from '../types'

import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessagesByText, findSimilarMessages, getChatsInFolder } from '@tg-search/db'
import { Elysia, t } from 'elysia'

import { createResponse } from '../utils/response'
import { createSSEMessage, createSSEResponse } from '../utils/sse'

const logger = useLogger()

/**
 * Convert database message to search result item
 */
function toSearchResultItem(msg: any, score: number): SearchResultItem {
  return {
    id: msg.id,
    chatId: msg.chatId,
    type: msg.type,
    content: msg.content,
    mediaInfo: msg.mediaInfo || null,
    fromId: msg.fromId,
    fromName: msg.fromName,
    fromAvatar: msg.fromAvatar,
    replyToId: msg.replyToId,
    forwardFromChatId: msg.forwardFromChatId,
    forwardFromChatName: msg.forwardFromChatName,
    forwardFromMessageId: msg.forwardFromMessageId,
    views: msg.views,
    forwards: msg.forwards,
    links: msg.links,
    metadata: msg.metadata,
    createdAt: msg.createdAt,
    score,
  }
}

/**
 * Search routes
 */
export const searchRoutes = new Elysia({ prefix: '/search' })
  .post('/', async ({ body }) => {
    const { query, folderId, chatId, limit = 20, offset = 0 } = body as SearchRequest
    const startTime = Date.now()

    // Log search request
    logger.withFields({
      query,
      folderId,
      chatId,
      limit,
      offset,
    }).debug('Search request received')

    return createSSEResponse(async (controller) => {
      // Send initial message
      controller.enqueue(createSSEMessage('info', 'Starting search...'))

      // Get chats to search in
      let targetChatId = chatId
      if (folderId) {
        // Search in folder
        const chats = await getChatsInFolder(folderId)
        if (chats.length === 0) {
          throw new Error('No chats found in folder')
        }
        if (chats.length === 1) {
          targetChatId = chats[0].id
        }
        logger.debug(`Searching in folder: ${folderId}, found ${chats.length} chats`)
        controller.enqueue(createSSEMessage('info', `Searching in folder ${folderId} (${chats.length} chats)`))
      }

      // 用于存储所有结果的 Map
      const allResults = new Map<number, SearchResultItem>()

      // 发送部分结果的函数
      const sendPartialResults = () => {
        const items = Array.from(allResults.values())
          .sort((a, b) => b.score - a.score)
          .slice(offset, offset + limit)

        const response = createResponse({
          total: allResults.size,
          items,
        }, undefined, {
          total: allResults.size,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          totalPages: Math.ceil(allResults.size / limit),
        })

        controller.enqueue(createSSEMessage('partial', response))
        logger.debug(`Sent partial results: ${items.length} items, total: ${allResults.size}`)
      }

      // 文本相似度搜索
      logger.debug('Starting text similarity search...')
      controller.enqueue(createSSEMessage('info', 'Starting text similarity search...'))

      const { items: similarResults } = await findMessagesByText(query, {
        chatId: targetChatId,
        limit: 1000, // Get more results for better ranking
      })

      // Add similarity search results
      similarResults.forEach((msg) => {
        allResults.set(msg.id, toSearchResultItem(msg, msg.similarity))
      })

      // Send partial results
      if (similarResults.length > 0) {
        logger.debug(`Found ${similarResults.length} similar matches`)
        controller.enqueue(createSSEMessage('info', `Found ${similarResults.length} similar matches`))
        sendPartialResults()
      }

      // 如果结果不够多，尝试向量搜索
      if (allResults.size < limit) {
        logger.debug('Not enough results, trying vector search...')
        controller.enqueue(createSSEMessage('info', 'Not enough results, trying vector search...'))

        const embedding = new EmbeddingService()
        try {
          const queryEmbedding = await embedding.generateEmbedding(query)
          logger.debug('Generated query embedding')
          controller.enqueue(createSSEMessage('info', 'Generated query embedding'))

          const vectorResults = await findSimilarMessages(queryEmbedding, {
            chatId: targetChatId!,
            limit: 1000, // Get more results for better ranking
          })

          // Add vector search results
          vectorResults.forEach((msg) => {
            if (allResults.has(msg.id)) {
              // 如果已存在文本匹配结果，提升分数
              allResults.get(msg.id)!.score = Math.max(
                allResults.get(msg.id)!.score,
                msg.similarity + 0.3, // 稍微降低向量搜索的权重
              )
            }
            else {
              allResults.set(msg.id, toSearchResultItem(msg, msg.similarity))
            }
          })

          // Send partial results
          if (vectorResults.length > 0) {
            logger.debug(`Found ${vectorResults.length} vector matches`)
            controller.enqueue(createSSEMessage('info', `Found ${vectorResults.length} vector matches`))
            sendPartialResults()
          }
        }
        catch (error) {
          logger.error('Vector search failed', { error })
          controller.enqueue(createSSEMessage('info', 'Vector search failed'))
        }
        finally {
          embedding.destroy()
        }
      }

      // 发送最终结果
      const finalItems = Array.from(allResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(offset, offset + limit)

      const finalResponse = createResponse({
        total: allResults.size,
        items: finalItems,
      }, undefined, {
        total: allResults.size,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        totalPages: Math.ceil(allResults.size / limit),
      })

      controller.enqueue(createSSEMessage('final', finalResponse))

      // Log search completion
      const duration = Date.now() - startTime
      logger.withFields({
        duration: `${duration}ms`,
        totalResults: allResults.size,
        returnedResults: finalItems.length,
      }).debug('Search completed')

      controller.enqueue(createSSEMessage('info', 'Search completed'))

      // 关闭流
      controller.close()
    })
  }, {
    body: t.Object({
      query: t.String(),
      folderId: t.Optional(t.Number()),
      chatId: t.Optional(t.Number()),
      limit: t.Optional(t.Number()),
      offset: t.Optional(t.Number()),
    }),
  })
