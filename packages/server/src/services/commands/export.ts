import type { ExportOptions } from '@tg-search/core'
import type { NewChat } from '@tg-search/db'
import type { Command, CommandHandler, CommandOptions, CommandStatus } from '../../types/command'

import { getConfig } from '@tg-search/common'
import { ExportService } from '@tg-search/core'

import { getTelegramClient } from '../telegram'

/**
 * Export command status details
 */
interface ExportStatus {
  totalMessages: number
  processedMessages: number
  failedMessages: number
  currentBatch: number
  totalBatches: number
  estimatedTimeRemaining?: number
  startTime: number
  currentSpeed: number // messages per second
}

/**
 * Export command details
 */
interface ExportDetails {
  // Status fields
  totalMessages?: number
  processedMessages?: number
  failedMessages?: number
  currentBatch?: number
  totalBatches?: number
  // Formatted fields
  startTime: string
  endTime?: string
  totalDuration?: string
  averageSpeed?: string
  estimatedTimeRemaining?: string
  currentSpeed?: string
  error?: {
    name: string
    message: string
    stack?: string
  } | string
}

/**
 * Extended command type with export details
 */
interface ExportCommand extends Command {
  details?: ExportDetails
}

/**
 * Export command handler
 */
export class ExportCommandHandler implements CommandHandler {
  private options: CommandOptions
  private status: ExportStatus = {
    totalMessages: 0,
    processedMessages: 0,
    failedMessages: 0,
    currentBatch: 0,
    totalBatches: 0,
    startTime: 0,
    currentSpeed: 0,
  }

  private currentCommand: ExportCommand | null = null

  constructor(options: CommandOptions) {
    this.options = options
  }

  /**
   * Create details object from status
   */
  private createDetails(): ExportDetails {
    return {
      totalMessages: this.status.totalMessages,
      processedMessages: this.status.processedMessages,
      failedMessages: this.status.failedMessages,
      currentBatch: this.status.currentBatch,
      totalBatches: this.status.totalBatches,
      startTime: new Date(this.status.startTime).toISOString(),
      estimatedTimeRemaining: this.status.estimatedTimeRemaining
        ? `${Math.ceil(this.status.estimatedTimeRemaining / 60)} minutes`
        : undefined,
      currentSpeed: `${Math.round(this.status.currentSpeed)} messages/sec`,
    }
  }

  /**
   * Update export status and notify progress
   */
  private updateStatus(
    progress: number,
    message: string,
    updates: Partial<ExportStatus>,
  ): void {
    // Update status
    Object.assign(this.status, updates)

    // Calculate estimated time remaining
    const elapsedTime = Date.now() - this.status.startTime
    if (this.status.processedMessages > 0) {
      this.status.currentSpeed = (this.status.processedMessages * 1000) / elapsedTime
      if (this.status.totalMessages > 0) {
        const remainingMessages = this.status.totalMessages - this.status.processedMessages
        this.status.estimatedTimeRemaining = remainingMessages / this.status.currentSpeed
      }
    }

    if (!this.currentCommand)
      return

    // Update command
    const updatedCommand: ExportCommand = {
      ...this.currentCommand,
      status: 'running' as CommandStatus,
      progress,
      message,
      details: this.createDetails(),
    }

    this.options.store.update(this.currentCommand.id, updatedCommand)
    this.options.onProgress?.(updatedCommand)
  }

  async execute(params: Omit<ExportOptions, 'chatMetadata'>): Promise<void> {
    const config = getConfig()
    const client = await getTelegramClient()
    const exportService = new ExportService(client)

    // Create command record
    this.currentCommand = this.options.store.create('export') as ExportCommand
    this.currentCommand.status = 'running'
    this.currentCommand.message = 'Starting export...'
    this.options.store.update(this.currentCommand.id, this.currentCommand)
    this.options.onProgress?.(this.currentCommand)

    // Initialize status
    this.status.startTime = Date.now()

    try {
      // Get chat info
      const client = await getTelegramClient()
      const chats = await client.getChats()
      const selectedChat = chats.find((c: NewChat) => c.id === params.chatId)
      if (!selectedChat) {
        throw new Error(`Chat not found: ${params.chatId}`)
      }

      // Set total messages
      this.status.totalMessages = params.limit || selectedChat.messageCount || 0
      this.status.totalBatches = Math.ceil(this.status.totalMessages / config.message.export.batchSize)

      await exportService.exportMessages({
        chatMetadata: selectedChat,
        chatId: params.chatId,
        format: params.format,
        messageTypes: params.messageTypes,
        startTime: params.startTime ? new Date(params.startTime) : undefined,
        endTime: params.endTime ? new Date(params.endTime) : undefined,
        limit: params.limit,
        batchSize: config.message.export.batchSize,
        method: params.method || 'takeout',
        onProgress: (progress: number, message: string, batchInfo?: {
          processed: number
          failed: number
          currentBatch: number
        }) => {
          this.updateStatus(progress, message, {
            processedMessages: batchInfo?.processed || this.status.processedMessages,
            failedMessages: batchInfo?.failed || this.status.failedMessages,
            currentBatch: batchInfo?.currentBatch || this.status.currentBatch,
          })
        },
      })

      if (!this.currentCommand)
        return

      // Update final status
      const finalCommand: ExportCommand = {
        ...this.currentCommand,
        status: 'success' as CommandStatus,
        progress: 100,
        message: 'Export completed',
        details: {
          ...this.createDetails(),
          endTime: new Date().toISOString(),
          totalDuration: `${Math.round((Date.now() - this.status.startTime) / 1000)} seconds`,
          averageSpeed: `${Math.round((this.status.processedMessages * 1000) / (Date.now() - this.status.startTime))} messages/sec`,
        },
      }
      this.options.store.update(this.currentCommand.id, finalCommand)
      this.options.onComplete?.(finalCommand)
    }
    catch (error) {
      if (!this.currentCommand)
        return

      // Update error status
      const errorCommand: ExportCommand = {
        ...this.currentCommand,
        status: 'error' as CommandStatus,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          ...this.createDetails(),
          error: error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : 'Unknown error',
          endTime: new Date().toISOString(),
          totalDuration: `${Math.round((Date.now() - this.status.startTime) / 1000)} seconds`,
        },
      }
      this.options.store.update(this.currentCommand.id, errorCommand)
      this.options.onError?.(errorCommand, error as Error)
    }
  }
}
