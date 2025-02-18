import type { Message } from '../../types/message'
import type { EmbeddingProgressContext } from './types'

import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { updateMessageEmbeddings } from '@tg-search/db'

const logger = useLogger()

/**
 * Process messages in batches and generate embeddings
 */
export async function processMessageBatch(
  chatId: number,
  messages: Message[],
  batchSize: number,
  concurrency: number,
  context: EmbeddingProgressContext,
): Promise<number> {
  let failedEmbeddings = 0
  const embedding = new EmbeddingService()

  // Split messages into batches
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize)
    logger.debug(`处理第 ${i + 1} 到 ${i + batch.length} 条消息`)

    try {
      // Generate embeddings in parallel
      const contents = batch.map(m => m.content!)
      const embeddings = await embedding.generateEmbeddings(contents)

      // Prepare updates
      const updates = batch.map((message, index) => ({
        id: message.id,
        embedding: embeddings[index],
      }))

      // Update embeddings in batches with concurrency control
      let processed = 0
      for (let j = 0; j < updates.length; j += concurrency) {
        const concurrentBatch = updates.slice(j, j + concurrency)
        await updateMessageEmbeddings(chatId, concurrentBatch)
        processed += concurrentBatch.length
        context.onMessageProgress(processed)
      }
    }
    catch (error) {
      logger.withError(error).warn(`批次处理失败：${error instanceof Error ? error.message : String(error)}`)
      failedEmbeddings += batch.length
    }

    context.onBatchProgress(i + batch.length)
  }

  return failedEmbeddings
}

/**
 * Create progress context with progress bars
 */
export function createProgressBars(multibar: any, totalMessages: number, batchSize: number) {
  const batchBar = multibar.create(Math.ceil(totalMessages / batchSize), 0, { title: '批次进度' })
  const messageBar = multibar.create(totalMessages, 0, { title: '消息进度' })

  return {
    totalMessages,
    batchSize,
    onBatchProgress: (processed: number) => batchBar.increment(),
    onMessageProgress: (processed: number) => messageBar.update(processed),
  }
}
