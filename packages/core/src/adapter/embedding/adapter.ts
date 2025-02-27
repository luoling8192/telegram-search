import type { EmbeddingModelConfig, IEmbeddingModel } from '../../types'

import { useLogger } from '@tg-search/common'

import { EmbeddingModelOllama } from './ollama'
import { EmbeddingModelOpenai } from './openai'

export class EmbeddingAdapter {
  private logger = useLogger()
  private config: EmbeddingModelConfig
  private embedding: IEmbeddingModel
  constructor(config: EmbeddingModelConfig) {
    this.config = config
    switch (config.provider) {
      case 'openai':
        this.embedding = new EmbeddingModelOpenai(config)
        break
      case 'ollama':
        this.embedding = new EmbeddingModelOllama(config)
        break
      default:
        this.logger.error('Unknown provider')
        throw new Error('Unknown provider')
    }
  }

  async generateEmbedding(text: string) {
    return await this.embedding.generateEmbedding(text)
  }

  async generateEmbeddings(texts: string[]) {
    return await this.embedding.generateEmbeddings(texts)
  }

  getUsage() {
    return this.embedding.getUsage()
  }

  destroy() {
    this.embedding.destroy()
  }
}
