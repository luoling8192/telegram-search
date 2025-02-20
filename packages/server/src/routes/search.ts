import type { SearchRequest, SearchResultItem } from '../types'

import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessagesByText, findSimilarMessages, getChatsInFolder } from '@tg-search/db'
import { Elysia, t } from 'elysia'

import { createResponse } from '../utils/response'

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
 * Create SSE message
 */
function createSSEMessage(event: string, data: unknown) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
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

    // 使用 ReadableStream 创建 SSE 响应
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
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

            // 文本搜索
            logger.debug('Starting text search...')
            controller.enqueue(createSSEMessage('info', 'Starting text search...'))

            const { items: textResults } = await findMessagesByText(query, {
              chatId: targetChatId,
              limit: 1000, // Get more results for better ranking
            })

            // Add text search results
            textResults.forEach((msg) => {
              if (!allResults.has(msg.id)) {
                allResults.set(msg.id, toSearchResultItem(msg, msg.similarity))
              }
            })

            // Send partial results
            if (textResults.length > 0) {
              logger.debug(`Found ${textResults.length} text matches`)
              controller.enqueue(createSSEMessage('info', `Found ${textResults.length} text matches`))
              sendPartialResults()
            }

            // 向量搜索
            logger.debug('Starting vector search...')
            controller.enqueue(createSSEMessage('info', 'Starting vector search...'))

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
                    msg.similarity + 0.5,
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
            finally {
              embedding.destroy()
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
          }
          catch (error) {
            // Log error
            logger.withError(error).error('Search failed')

            // 发送错误消息
            controller.enqueue(createSSEMessage('error', createResponse(undefined, error)))
            controller.close()
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      },
    )
  }, {
    body: t.Object({
      query: t.String(),
      folderId: t.Optional(t.Number()),
      chatId: t.Optional(t.Number()),
      limit: t.Optional(t.Number()),
      offset: t.Optional(t.Number()),
    }),
  })
