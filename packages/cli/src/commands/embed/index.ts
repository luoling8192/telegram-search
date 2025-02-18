import type { EmbedOptions } from './types'

import { useLogger } from '@tg-search/common'
import { findMessagesByChatId } from '@tg-search/db'
import cliProgress from 'cli-progress'

import { createLoggingMiddleware } from '../../middleware/logging'
import { CommandError, TelegramCommand } from '../../types/command'
import { createProgressBars, processMessageBatch } from './utils'

const logger = useLogger()

/**
 * Embed command to generate embeddings for messages
 */
export class EmbedCommand extends TelegramCommand<EmbedOptions> {
  meta = {
    name: 'embed',
    description: 'Generate embeddings for messages',
    usage: '[options]',
    options: [
      {
        flags: '-c, --chat-id <id>',
        description: '会话 ID',
      },
      {
        flags: '-b, --batch-size <size>',
        description: '每批处理的消息数量',
        default: '1000',
      },
      {
        flags: '--concurrency <number>',
        description: '并发数',
        default: '4',
      },
    ],
  }

  constructor() {
    super()
    this.use(createLoggingMiddleware<EmbedOptions>())
  }

  validateOptions(options: unknown): asserts options is EmbedOptions {
    if (typeof options !== 'object' || options === null)
      throw new CommandError('Invalid options', 'INVALID_OPTIONS')
  }

  async execute(_args: string[], options: EmbedOptions): Promise<void> {
    const {
      chatId,
      batchSize = 10,
      concurrency = 5,
    } = options

    if (!chatId)
      throw new CommandError('会话 ID 是必需的', 'MISSING_CHAT_ID')

    // Get messages
    const { items: messages } = await findMessagesByChatId(chatId)
    if (messages.length === 0) {
      logger.warn('No messages found')
      return
    }

    // Create progress bars
    const multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{title} [{bar}] {percentage}% | {value}/{total}',
    })

    // Create progress context
    const context = createProgressBars(multibar, messages.length, batchSize)

    // Process messages in batches
    const failedEmbeddings = await processMessageBatch(
      chatId,
      messages.map(message => ({
        id: message.id,
        chatId: message.chatId,
        type: message.type,
        content: message.content || '',
        createdAt: message.createdAt,
        fromId: message.fromId || undefined,
        fromName: message.fromName || undefined,
        fromAvatar: message.fromAvatar || undefined,
        replyToId: message.replyToId || undefined,
        forwardFromChatId: message.forwardFromChatId || undefined,
        forwardFromMessageId: message.forwardFromMessageId || undefined,
        views: message.views || undefined,
        forwards: message.forwards || undefined,
        mediaInfo: message.mediaInfo || undefined,
      })),
      batchSize,
      concurrency,
      context,
    )

    // Stop progress bars
    multibar.stop()

    // Log results
    if (failedEmbeddings > 0)
      logger.warn(`Failed to generate embeddings for ${failedEmbeddings} messages`)
    else
      logger.log('All embeddings generated successfully')
  }
}

// Register command
export default new EmbedCommand()
