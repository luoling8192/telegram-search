/**
 * Embed command options
 */
export interface EmbedOptions {
  batchSize?: number
  chatId?: number
  concurrency?: number
}

/**
 * Message update with embedding
 */
export interface MessageEmbeddingUpdate {
  id: number
  embedding: number[]
}

/**
 * Progress context for embedding process
 */
export interface EmbeddingProgressContext {
  totalMessages: number
  batchSize: number
  onBatchProgress: (processed: number) => void
  onMessageProgress: (processed: number) => void
}
