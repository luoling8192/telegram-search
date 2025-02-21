import type { Command as BaseCommand } from '@tg-search/server/types'

/**
 * Export command parameters
 */
export interface ExportParams {
  chatId: number
  messageTypes: string[]
  format?: 'database' | 'html' | 'json'
  startTime?: string
  endTime?: string
  limit?: number
  method?: 'getMessage' | 'takeout'
}

/**
 * Export command details
 */
export interface ExportDetails {
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
 * Extended command type with details
 */
export interface Command extends BaseCommand {
  details?: ExportDetails | Record<string, any>
}

export type { BaseCommand }
