import type { CommandHandler, CommandOptions, ExportMethod, MessageType } from '../../types/command'

import { getConfig } from '@tg-search/common'
import { ExportService } from '@tg-search/core'

import { getTelegramClient } from '../telegram'

export interface ExportCommandParams {
  chatId: number
  format?: 'database' | 'html' | 'json'
  messageTypes?: MessageType[]
  startTime?: string
  endTime?: string
  limit?: number
  method?: ExportMethod
}

/**
 * Export command handler
 */
export class ExportCommandHandler implements CommandHandler {
  private options: CommandOptions

  constructor(options: CommandOptions) {
    this.options = options
  }

  async execute(params: ExportCommandParams): Promise<void> {
    const config = getConfig()
    const client = await getTelegramClient()
    const exportService = new ExportService(client)

    // Create command record
    const command = this.options.store.create('export')
    command.status = 'running'
    command.message = 'Starting export...'
    this.options.store.update(command.id, command)
    this.options.onProgress?.(command)

    try {
      await exportService.exportMessages({
        chatId: params.chatId,
        format: params.format,
        messageTypes: params.messageTypes,
        startTime: params.startTime ? new Date(params.startTime) : undefined,
        endTime: params.endTime ? new Date(params.endTime) : undefined,
        limit: params.limit,
        batchSize: config.message.export.batchSize,
        method: params.method || 'takeout',
        onProgress: (progress: number, message: string) => {
          command.progress = progress
          command.message = message
          this.options.store.update(command.id, command)
          this.options.onProgress?.(command)
        },
      })

      // Update command status
      command.status = 'success'
      command.progress = 100
      command.message = 'Export completed'
      this.options.store.update(command.id, command)
      this.options.onComplete?.(command)
    }
    catch (error) {
      // Update command status
      command.status = 'error'
      command.message = error instanceof Error ? error.message : 'Unknown error'
      this.options.store.update(command.id, command)
      this.options.onError?.(command, error as Error)
    }
  }
}
