import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import {
  getMessageCount,
  getMessagesWithoutEmbedding,
  getPartitionTables,
  updateMessageEmbedding,
} from '@tg-search/db'

import { TelegramCommand } from '../command'

const logger = useLogger()

interface EmbedOptions {
  batchSize?: number
  chatId?: number
  concurrency?: number
}

/**
 * Embed command to generate embeddings for messages
 */
export class EmbedCommand extends TelegramCommand {
  meta = {
    name: 'embed',
    description: 'Generate embeddings for messages',
    usage: '[options]',
  }

  async execute(_args: string[], options: EmbedOptions): Promise<void> {
    // Get batch size
    const batchSize = options.batchSize || await input.input({
      message: '请输入每批处理的消息数量：',
      default: '1000',
    })

    // Get chat ID
    const chatId = options.chatId || await input.input({
      message: '请输入会话 ID（留空处理所有会话）：',
      default: '',
    })

    // Get concurrency
    const _concurrency = options.concurrency || await input.input({
      message: '请输入并发数：',
      default: '4',
    })

    // Initialize embedding service
    const embedding = new EmbeddingService()

    try {
      // Get message count
      const tables = await getPartitionTables()
      let totalMessages = 0
      let totalProcessed = 0
      let failedEmbeddings = 0

      for (const table of tables) {
        const count = await getMessageCount(Number(table.tableName))
        totalMessages += count
      }

      logger.log(`共有 ${totalMessages} 条消息需要处理`)

      // Process messages in batches
      while (true) {
        const messages = await getMessagesWithoutEmbedding(
          chatId ? Number(chatId) : undefined,
          Number(batchSize),
        )

        if (messages.length === 0) {
          break
        }

        logger.debug(`获取到 ${messages.length} 条消息`)

        // Generate embeddings in parallel
        const contents = messages.map(m => m.content || '')
        const embeddings = await embedding.generateEmbeddings(contents)

        // Update embeddings
        for (let i = 0; i < messages.length; i++) {
          const message = messages[i]
          try {
            await updateMessageEmbedding(message.id, message.chatId, embeddings[i])
            totalProcessed++
          }
          catch (error) {
            logger.withError(error).warn(`更新消息 ${message.id} 的向量嵌入失败`)
            failedEmbeddings++
          }
        }

        logger.log(`已处理 ${totalProcessed}/${totalMessages} 条消息，${failedEmbeddings} 条失败`)
      }

      logger.log('向量嵌入生成完成')
    }
    catch (error) {
      logger.withError(error).error('向量嵌入生成失败')
      throw error
    }
  }
}

// Register command
export default new EmbedCommand()
