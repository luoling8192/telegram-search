import type { ITelegramClientAdapter, TelegramMessage, TelegramMessageType } from '../adapter/types'

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
  chatId: number
  format?: ExportFormat
  messageTypes?: TelegramMessageType[]
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
  ): Promise<void> {
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
        `Saved messages ${startIndex + 1} - ${startIndex + messages.length} `
        + `(ID: ${messages[0].id} - ${messages[messages.length - 1].id})`,
      )
    }
    catch (error) {
      logger.withError(error).error(`Failed to save batch (${startIndex + 1} - ${startIndex + messages.length})`)
      throw error
    }
  }

  /**
   * Export messages from chat
   */
  async exportMessages(options: ExportOptions): Promise<void> {
    const {
      chatId,
      messageTypes = ['text'],
      startTime,
      endTime,
      limit,
      batchSize = getConfig().message.export.batchSize,
      method = 'takeout',
      onProgress,
    } = options

    // Get chat info
    const chats = await this.client.getChats()
    const selectedChat = chats.find(c => c.id === chatId)
    if (!selectedChat) {
      throw new Error(`Chat not found: ${chatId}`)
    }

    // Report progress
    onProgress?.(5, `Selected chat: ${selectedChat.title}`)

    // Export messages
    let count = 0
    let messages: TelegramMessage[] = []
    const total = limit || selectedChat.messageCount || 100

    try {
      // Try to export messages
      for await (const message of this.client.getMessages(chatId, undefined, {
        skipMedia: messageTypes.length === 1 && messageTypes[0] === 'text',
        startTime,
        endTime,
        limit,
        messageTypes,
        method,
      })) {
        messages.push(message)
        count++

        // Process batch if needed
        if (messages.length >= batchSize) {
          await this.processDatabaseBatch(messages, count - messages.length)
          messages = []

          // Report progress
          const progress = Math.min(95, Math.floor((count / total) * 90) + 5)
          onProgress?.(progress, `Processed ${count} messages`)
        }

        // Check if we need to stop
        if (limit && count >= limit) {
          break
        }
      }

      // Process remaining messages
      if (messages.length > 0) {
        await this.processDatabaseBatch(messages, count - messages.length)
      }

      // Update chat metadata
      await updateChat({
        id: selectedChat.id,
        type: selectedChat.type,
        title: selectedChat.title,
        lastSyncTime: new Date(),
      })

      // Report completion
      onProgress?.(100, `Export completed, processed ${count} messages`)
    }
    catch (error: any) {
      // Handle special errors
      if (error?.message?.includes('TAKEOUT_INIT_DELAY')) {
        const waitSeconds = Number(error.message.match(/TAKEOUT_INIT_DELAY_(\d+)/)?.[1])
        if (waitSeconds) {
          const waitHours = Math.ceil(waitSeconds / 3600)
          const message = `Need to wait ${waitHours} hours to use takeout export`
          logger.warn(message)
          onProgress?.(0, message)
          throw error
        }
      }
      else if (error?.message?.includes('FLOOD_WAIT')) {
        const waitSeconds = Number(error.message.match(/FLOOD_WAIT_(\d+)/)?.[1])
        if (waitSeconds) {
          const message = `Need to wait ${waitSeconds} seconds to continue`
          logger.warn(message)
          onProgress?.(count > 0 ? 50 : 0, message)
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
          logger.log('Continuing export...')
          onProgress?.(count > 0 ? 55 : 5, 'Continuing export...')
        }
      }

      throw error
    }
  }
}

// Export default instance
export default ExportService
