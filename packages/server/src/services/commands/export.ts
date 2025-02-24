import type { ExportOptions, ITelegramClientAdapter } from '@tg-search/core'
import type { Command, CommandOptions } from '../../types/apis/command'

import { ExportService } from '@tg-search/core'
import { z } from 'zod'

/**
 * Export command schema
 */
export const exportCommandSchema = z.object({
  chatId: z.number(),
  format: z.enum(['database', 'html', 'json']).optional(),
  messageTypes: z.array(z.enum(['text', 'photo', 'video', 'document', 'sticker', 'other'])).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  limit: z.number().optional(),
  method: z.enum(['getMessage', 'takeout']).optional(),
})

/**
 * Export command handler
 */
export class ExportCommandHandler {
  private options?: CommandOptions
  private command: Command

  constructor(options?: CommandOptions) {
    this.options = options
    this.command = {
      id: crypto.randomUUID(),
      type: 'export',
      status: 'pending',
      progress: 0,
      message: '',
    }
  }

  private updateProgress(progress: number, message: string) {
    this.command = {
      ...this.command,
      status: 'running',
      progress,
      message,
    }
    this.options?.onProgress(this.command)
  }

  async execute(client: ITelegramClientAdapter, params: ExportOptions) {
    try {
      const exportService = new ExportService(client)

      const result = await exportService.exportMessages({
        ...params,
        onProgress: (progress, message) => {
          this.updateProgress(progress, message)
        },
      })

      this.command = {
        ...this.command,
        status: 'completed',
        progress: 100,
        result,
      }
      this.options?.onComplete(this.command)
    }
    catch (error) {
      this.command = {
        ...this.command,
        status: 'failed',
        error: error as Error,
      }
      this.options?.onError(this.command, error as Error)
    }
  }
}
