import type { Command } from './command'

/**
 * Export command status details
 */
export interface ExportStatus {
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
 * Extended command type with export details
 */
export interface ExportCommand extends Command {
  details?: ExportDetails
}
