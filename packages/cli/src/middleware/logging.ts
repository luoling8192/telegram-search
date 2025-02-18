import { useLogger } from '@tg-search/common'
import type { BaseCommand, CommandMiddleware } from '../types/command'

const logger = useLogger()

/**
 * Logging middleware for commands
 */
export function createLoggingMiddleware<TOptions>(): CommandMiddleware<TOptions> {
  return {
    before: async (command: BaseCommand<TOptions>, args: string[], options: TOptions) => {
      logger.log(`Executing command: ${command.meta.name}`)
      logger.debug('Command arguments:', { args, options })
    },
    after: async (command: BaseCommand<TOptions>, args: string[], options: TOptions) => {
      logger.log(`Command completed: ${command.meta.name}`)
    },
  }
} 
