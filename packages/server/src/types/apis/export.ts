import type { DatabaseMessageType } from '@tg-search/db'
import type { ExportMethod } from './command'

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
 * Export params
 */
export interface ExportParams {
  chatId: number
  messageTypes: DatabaseMessageType[]
  method: ExportMethod
  [key: string]: unknown
}
