import type { Message } from '../../types/message'
import type { SearchOptions } from './types'

import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessagesByChatId, findSimilarMessages } from '@tg-search/db'

import { createLoggingMiddleware } from '../../middleware/logging'
import { CommandError, TelegramCommand } from '../../types/command'

const logger = useLogger()

/**
 * Search command to search messages by content
 */
export class SearchCommand extends TelegramCommand<SearchOptions> {
  meta = {
    name: 'search',
    description: 'Search messages by content',
    usage: '[options]',
    options: [
      {
        flags: '-c, --chat-id <id>',
        description: '会话 ID',
      },
      {
        flags: '-q, --query <text>',
        description: '搜索关键词',
      },
      {
        flags: '-l, --limit <number>',
        description: '返回结果数量',
        default: '10',
      },
      {
        flags: '-o, --offset <number>',
        description: '跳过结果数量',
        default: '0',
      },
    ],
  }

  constructor() {
    super()
    this.use(createLoggingMiddleware<SearchOptions>())
  }

  validateOptions(options: unknown): asserts options is SearchOptions {
    if (typeof options !== 'object' || options === null)
      throw new CommandError('Invalid options', 'INVALID_OPTIONS')
  }

  async execute(_args: string[], options: SearchOptions): Promise<void> {
    const {
      chatId,
      query,
      limit = 10,
      offset = 0,
    } = options

    if (!chatId)
      throw new CommandError('会话 ID 是必需的', 'MISSING_CHAT_ID')

    if (!query)
      throw new CommandError('搜索关键词是必需的', 'MISSING_QUERY')

    try {
      // Get messages
      const { items: messages } = await findMessagesByChatId(chatId)
      if (messages.length === 0) {
        logger.warn('No messages found')
        return
      }

      // Generate embedding for query
      const embedding = new EmbeddingService()
      const queryEmbedding = await embedding.generateEmbeddings([query])
      if (!queryEmbedding || queryEmbedding.length === 0) {
        logger.warn('Failed to generate embedding for query')
        return
      }

      // Search similar messages
      const results = await findSimilarMessages(queryEmbedding[0], {
        chatId,
        limit,
        offset,
      })

      // Print results
      if (results.length === 0) {
        logger.log('No results found')
        return
      }

      // Print results
      logger.log(`Found ${results.length} results:`)
      for (const result of results) {
        const message: Message = {
          id: result.id,
          chatId: result.chatId,
          type: result.type as Message['type'],
          content: result.content || '',
          createdAt: result.createdAt,
          fromId: result.fromId || undefined,
          fromName: result.fromName || undefined,
          fromAvatar: result.fromAvatar || undefined,
          replyToId: result.replyToId || undefined,
          forwardFromChatId: result.forwardFromChatId || undefined,
          forwardFromMessageId: result.forwardFromMessageId || undefined,
          views: result.views || undefined,
          forwards: result.forwards || undefined,
          mediaInfo: result.mediaInfo || undefined,
        }
        logger.log(`[${message.createdAt.toLocaleString()}] ${message.content}`)
      }
    }
    catch (error) {
      logger.withError(error).error('搜索失败')
      throw error
    }
  }
}

// Register command
export default new SearchCommand()
