import type { ClientAdapter } from '../../core/src/adapter/client'

/**
 * Command metadata interface
 */
interface CommandMeta {
  // Command name
  name: string
  // Command description
  description: string
  // Command usage example
  usage?: string
  // Whether the command requires Telegram connection
  requiresConnection?: boolean
  // Whether the command can be run in background
  isBackground?: boolean
}

/**
 * Base command interface
 */
export interface Command {
  // Command metadata
  meta: CommandMeta
  // Command execution function
  execute: (args: string[], options: Record<string, any>) => Promise<void>
}

/**
 * Base command class with Telegram client
 */
export abstract class TelegramCommand implements Command {
  protected client?: ClientAdapter

  abstract meta: CommandMeta
  abstract execute(args: string[], options: Record<string, any>): Promise<void>

  /**
   * Set Telegram client
   */
  setClient(client: ClientAdapter) {
    this.client = client
  }

  /**
   * Get Telegram client
   */
  protected getClient(): ClientAdapter {
    if (!this.client) {
      throw new Error('Telegram client not initialized')
    }
    return this.client
  }
}

/**
 * Command registry
 */
class CommandRegistry {
  private commands: Map<string, Command> = new Map()

  /**
   * Register a command
   */
  register(command: Command) {
    this.commands.set(command.meta.name, command)
  }

  /**
   * Get a command by name
   */
  get(name: string): Command | undefined {
    return this.commands.get(name)
  }

  /**
   * Get all registered commands
   */
  getAll(): Command[] {
    return Array.from(this.commands.values())
  }
}

// Export singleton instance
export const registry = new CommandRegistry()
