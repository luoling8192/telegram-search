import { useLogger } from '@tg-search/common'
import { eq } from 'drizzle-orm'

import { useDB } from '../composable/db'
import { createMessageContentTable } from '../db/schema/message'
import { getMessageCount, getMessagesWithoutEmbedding, getPartitionTables } from '../models/message'
import { EmbeddingService } from '../services/embedding'

interface EmbedOptions {
  batchSize?: number
  chatId?: number
  concurrency?: number
}

/**
 * Process a batch of messages
 */
async function processBatch(
  messages: { id: number, content: string | null, chatId: number }[],
  embedding: EmbeddingService,
  logger: ReturnType<typeof useLogger>,
) {
  const result = {
    processed: 0,
    failed: 0,
  }

  if (messages.length === 0)
    return result

  try {
    // Generate embeddings
    const texts = messages.map(msg => msg.content || '')
    const embeddings = await embedding.generateEmbeddings(texts)

    // Update messages with embeddings
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      const embedding = embeddings[i]

      try {
        // Update message with embedding
        await useDB().update(createMessageContentTable(message.chatId)).set({ embedding }).where(eq(messages.id, message.id))

        result.processed++
      }
      catch (error) {
        logger.withError(error).warn(`更新消息 ${message.id} 的向量嵌入失败`)
        result.failed++
      }
    }
  }
  catch (error) {
    logger.withError(error).warn('生成向量嵌入失败')
    result.failed += messages.length
  }

  return result
}

/**
 * Generate embeddings for messages that don't have them
 */
export default async function embed(options: Partial<EmbedOptions> = {}) {
  const logger = useLogger()

  // Initialize embedding service
  const embedding = new EmbeddingService()

  // Get options
  const batchSize = options.batchSize || 100
  const concurrency = options.concurrency || 1

  try {
    // 获取需要处理的消息总数
    const count = await getMessageCount(options.chatId)

    if (count === 0) {
      logger.log('没有需要处理的消息')
      return
    }

    logger.log(`找到 ${count} 条消息需要生成向量嵌入`)
    let processed = 0
    let failed = 0

    // 获取所有分区表
    const partitionTables = await getPartitionTables(options.chatId)

    for (const { tableName, chatId } of partitionTables) {
      while (true) {
        // 获取多个批次的消息
        const batches = await Promise.all(
          Array.from({ length: concurrency }, () =>
            getMessagesWithoutEmbedding(chatId, batchSize)),
        )

        // 过滤掉空批次
        const validBatches = batches.filter(batch => batch.length > 0)
        if (validBatches.length === 0)
          break

        // 并行处理多个批次
        const results = await Promise.all(
          validBatches.map(batch => processBatch(batch, embedding, logger)),
        )

        // 统计处理结果
        for (const result of results) {
          processed += result.processed
          failed += result.failed
        }

        logger.debug(`已处理 ${processed}/${count} 条消息`)
      }
    }

    logger.log(`处理完成，共处理 ${processed} 条消息，${failed} 条消息失败`)

    // 显示使用统计
    const usage = embedding.getUsage()
    logger.log(`Token 使用量：${usage.tokens.toLocaleString()} tokens`)
    logger.log(`预估成本：$${usage.cost.toFixed(4)} USD`)
  }
  catch (error) {
    logger.withError(error).error('处理失败')
    throw error
  }
  finally {
    embedding.destroy()
  }
}
