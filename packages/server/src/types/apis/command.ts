import type { ITelegramClientAdapter } from '@tg-search/core'

/**
 * Supported command types for background tasks
 */
export const commandTypes = ['export', 'import', 'sync', 'watch'] as const
export type CommandType = typeof commandTypes[number]

/**
 * Command execution status states
 */
export const commandStatus = ['idle', 'running', 'success', 'error'] as const
export type CommandStatus = typeof commandStatus[number]

/**
 * Available methods for exporting messages
 */
export const exportMethods = ['getMessage', 'takeout'] as const
export type ExportMethod = typeof exportMethods[number]

/**
 * Base command interface representing a background task
 */
export interface Command {
  id: string
  type: 'export' | 'import' | 'stats'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting'
  progress: number
  message: string
  result?: unknown
  error?: Error
  metadata?: Record<string, unknown>
}

/**
 * Handler interface for executing command logic
 */
export interface CommandHandler {
  execute: (client: ITelegramClientAdapter, params: Record<string, unknown>) => Promise<void>
  onProgress?: (progress: number, message: string) => void
}

/**
 * Configuration options for command execution
 */
export interface CommandOptions {
  onProgress: (command: Command) => void
  onComplete: (command: Command) => void
  onError: (command: Command, error: Error) => void
}
