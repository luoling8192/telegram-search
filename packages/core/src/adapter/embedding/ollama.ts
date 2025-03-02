import type { EmbeddingModelConfig, IEmbeddingModel } from './../../types/adapter'

import { useLogger } from '@tg-search/common'
import { embed } from '@xsai/embed'

export class EmbeddingModelOllama implements IEmbeddingModel {
  private config: EmbeddingModelConfig
  private logger = useLogger()
  private totalTokens = 0
  private totalCost = 0
  constructor(config: EmbeddingModelConfig) {
    this.config = config
  }

  getTokenCount(text: string) {
    return text ? 0 : 0
  }

  getTotalTokens(texts: string[]) {
    return texts.reduce((sum, text) => sum + this.getTokenCount(text), 0)
  }

  calculateCost(tokens: number) {
    return tokens ? 0 : 0
  }

  getUsage() {
    return {
      tokens: this.totalTokens,
      cost: this.totalCost,
    }
  }

  async generateEmbedding(text: string) {
    try {
      const tokenCount = this.getTokenCount(text)
      const { embedding } = await embed({
        model: this.config.model,
        input: text,
        baseURL: 'http://localhost:11434/v1',
      })
      this.totalTokens += tokenCount
      this.totalCost += this.calculateCost(tokenCount)
      return embedding
    }
    catch (error) {
      this.logger.withError(error).error('生成向量嵌入失败')
      throw error
    }
  }

  async generateEmbeddings(texts: string[]) {
    try {
      const totalTokens = this.getTotalTokens(texts)
      const embeddings = []
      for (const text of texts) {
        embeddings.push(await this.generateEmbedding(text))
      }
      this.totalTokens += totalTokens
      this.totalCost += this.calculateCost(totalTokens)
      return embeddings
    }
    catch (error) {
      this.logger.withError(error).error('批量生成向量嵌入失败')
      throw error
    }
  }

  destroy() {

  }
}
