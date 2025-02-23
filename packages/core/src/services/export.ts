import type { DatabaseMessageType, DatabaseNewChat } from '@tg-search/db'
import type { ITelegramClientAdapter } from '../types/adapter'
import type { TelegramMessage } from '../types/message'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getConfig, useLogger } from '@tg-search/common'
import { createMessages, updateChat } from '@tg-search/db'

const logger = useLogger()

/**
 * Export format type
 */
export type ExportFormat = 'database' | 'html' | 'json'

/**
 * Export method type
 */
export type ExportMethod = 'getMessage' | 'takeout'

/**
 * Export service options
 */
export interface ExportOptions {
  chatMetadata: DatabaseNewChat
  chatId: number
  format?: ExportFormat
  path?: string
  messageTypes?: DatabaseMessageType[]
  startTime?: Date
  endTime?: Date
  limit?: number
  batchSize?: number
  method?: ExportMethod
  onProgress?: (progress: number, message: string) => void
}

/**
 * Export service for handling message exports
 * Focuses on database export for MVP
 */
export class ExportService {
  constructor(private client: ITelegramClientAdapter) {}

  /**
   * Process a batch of messages for database export
   */
  private async processDatabaseBatch(
    messages: TelegramMessage[],
    startIndex: number,
  ): Promise<{ failedCount: number }> {
    try {
      // Convert messages to database format
      const messagesToCreate = messages.map(msg => ({
        id: msg.id,
        chatId: msg.chatId,
        type: msg.type,
        content: msg.content || '',
        fromId: msg.fromId,
        fromName: msg.fromName,
        replyToId: msg.replyToId,
        forwardFromChatId: msg.forwardFromChatId,
        forwardFromChatName: msg.forwardFromChatName,
        forwardFromMessageId: msg.forwardFromMessageId,
        views: msg.views,
        forwards: msg.forwards,
        links: msg.links || undefined,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
        // Only include media info if exists
        ...(msg.mediaInfo && {
          mediaType: msg.mediaInfo.type,
          mediaFileId: msg.mediaInfo.fileId,
          mediaFileName: msg.mediaInfo.fileName,
          mediaMimeType: msg.mediaInfo.mimeType,
        }),
      }))

      // Create messages in batch
      await createMessages(messagesToCreate)
      logger.debug(
        `已保存 ${startIndex + 1} - ${startIndex + messages.length} 条消息 `
        + `(ID: ${messages[0].id} - ${messages[messages.length - 1].id})`,
      )
      return { failedCount: 0 }
    }
    catch (error) {
      logger.withError(error).error(`保存批次消息失败 (${startIndex + 1} - ${startIndex + messages.length})`)
      return { failedCount: messages.length }
    }
  }

  /**
   * Save messages to JSON file
   */
  private async saveToJsonFile(messages: TelegramMessage[], chatId: number, exportPath: string): Promise<boolean> {
    try {
      await fs.mkdir(exportPath, { recursive: true })

      const fileName = `${chatId}_${new Date().toISOString().split('T')[0]}`
      const filePath = path.join(exportPath, `${fileName}.json`)
      await fs.writeFile(filePath, JSON.stringify(messages, null, 2))
      logger.debug(`已保存 JSON 文件: ${filePath}`)
      logger.log(`已导出到文件: ${filePath}`)
      return true
    }
    catch (error) {
      logger.withError(error).error('保存 JSON 文件失败')
      return false
    }
  }

  /**
   * Export messages from chat
   */
  async exportMessages(options: ExportOptions): Promise<{ count: number, failedCount: number }> {
    const {
      chatMetadata,
      chatId,
      format = 'database',
      path: exportPath,
      messageTypes = ['text'],
      startTime,
      endTime,
      limit,
      batchSize = getConfig().message.export.batchSize,
      method = 'takeout',
      onProgress,
    } = options

    // Report progress
    onProgress?.(5, `已选择会话: ${chatMetadata.title}`)

    // Export messages
    let count = 0
    let failedCount = 0
    let messages: TelegramMessage[] = []
    const total = limit || chatMetadata.messageCount || 100

    function isSkipMedia(type: DatabaseMessageType) {
      return !messageTypes.includes(type)
    }

    try {
      // Try to export messages
      for await (const message of this.client.getMessages(chatId, undefined, {
        skipMedia: isSkipMedia('photo') || isSkipMedia('video') || isSkipMedia('document'),
        startTime,
        endTime,
        limit,
        messageTypes,
        method,
      })) {
        messages.push(message)
        count++

        // Process batch if needed
        if (format === 'database' && messages.length >= batchSize) {
          const result = await this.processDatabaseBatch(messages, count - messages.length)
          failedCount += result.failedCount
          messages = []

          // Report progress
          const progress = Math.min(95, Math.floor((count / total) * 90) + 5)
          onProgress?.(progress, `已处理 ${count} 条消息`)
        }

        // Check if we need to stop
        if (limit && count >= limit) {
          break
        }
      }

      // Process remaining messages
      if (messages.length > 0) {
        if (format === 'database') {
          const result = await this.processDatabaseBatch(messages, count - messages.length)
          failedCount += result.failedCount
        }
        else if (format === 'json' && exportPath) {
          const success = await this.saveToJsonFile(messages, chatId, exportPath)
          if (!success) {
            failedCount = count
          }
        }
        else if (format === 'html') {
          logger.warn('HTML 导出暂未实现')
        }
      }

      // Update chat metadata
      if (format === 'database') {
        await updateChat({
          id: chatMetadata.id,
          type: chatMetadata.type,
          title: chatMetadata.title,
          lastSyncTime: new Date(),
        })
      }

      // Report completion
      const summary = failedCount > 0
        ? `导出完成，共导出 ${count} 条消息，${failedCount} 条消息失败`
        : `导出完成，共导出 ${count} 条消息`
      onProgress?.(100, summary)

      return { count, failedCount }
    }
    catch (error: any) {
      // Handle special errors
      if (error?.message?.includes('TAKEOUT_INIT_DELAY')) {
        const waitSeconds = Number(error.message.match(/TAKEOUT_INIT_DELAY_(\d+)/)?.[1])
        if (waitSeconds) {
          const waitHours = Math.ceil(waitSeconds / 3600)
          const message = `需要等待 ${waitHours} 小时才能使用 takeout 导出`
          logger.warn(message)
          onProgress?.(0, message)
          throw error
        }
      }
      else if (error?.message?.includes('FLOOD_WAIT')) {
        const waitSeconds = Number(error.message.match(/FLOOD_WAIT_(\d+)/)?.[1])
        if (waitSeconds) {
          const message = `需要等待 ${waitSeconds} 秒才能继续`
          logger.warn(message)
          onProgress?.(count > 0 ? 50 : 0, message)
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
          logger.log('继续导出...')
          onProgress?.(count > 0 ? 55 : 5, '继续导出...')
        }
      }

      throw error
    }
  }
}

// Export default instance
export default ExportService
