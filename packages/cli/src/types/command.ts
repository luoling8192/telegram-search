import type { ClientAdapter, TelegramAdapter } from '@tg-search/core'

/**
 * Command option interface
 */
export interface CommandOption {
  // Option flags (e.g. '-p, --path <path>')
  flags: string
  // Option description
  description: string
  // Whether the option is required
  required?: boolean
  // Default value
  default?: unknown
}

/**
 * Command metadata interface
 */
export interface CommandMeta {
  // Command name
  name: string
  // Command description
  description: string
  // Command usage example
  usage?: string
  // Command options
  options?: CommandOption[]
  // Whether the command requires Telegram connection
  requiresConnection?: boolean
  // Whether the command can be run in background
  isBackground?: boolean
  // Whether the command requires client adapter
  requiresClient?: boolean
}

/**
 * Base command error
 */
export class CommandError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'CommandError'
  }
}

/**
 * Command middleware interface
 */
export interface CommandMiddleware<TOptions = unknown> {
  before?: (command: BaseCommand<TOptions>, args: string[], options: TOptions) => Promise<void>
  after?: (command: BaseCommand<TOptions>, args: string[], options: TOptions) => Promise<void>
}

/**
 * Base command interface
 */
export interface BaseCommand<TOptions = unknown> {
  // Command metadata
  meta: CommandMeta
  // Command execution function
  execute: (args: string[], options: TOptions) => Promise<void>
  // Optional client setter
  setClient?: (client: TelegramAdapter) => void
}

/**
 * Base command class with Telegram client
 */
export abstract class TelegramCommand<TOptions = unknown, T extends TelegramAdapter = ClientAdapter> implements BaseCommand<TOptions> {
  protected client?: T
  protected middleware: CommandMiddleware<TOptions>[] = []

  abstract meta: CommandMeta
  abstract execute(args: string[], options: TOptions): Promise<void>
  abstract validateOptions(options: unknown): asserts options is TOptions

  /**
   * Set Telegram client
   */
  setClient(client: TelegramAdapter) {
    // Check if command requires client adapter
    if (this.meta.requiresClient && client.type === 'bot') {
      throw new CommandError(
        'This command requires client adapter',
        'INVALID_CLIENT',
      )
    }
    this.client = client as T
  }

  /**
   * Get Telegram client
   */
  protected getClient(): T {
    if (!this.client) {
      throw new CommandError(
        'Telegram client not initialized',
        'CLIENT_NOT_INITIALIZED',
      )
    }
    return this.client
  }

  /**
   * Add middleware
   */
  use(middleware: CommandMiddleware<TOptions>) {
    this.middleware.push(middleware)
  }

  /**
   * Run command with middleware
   */
  async run(args: string[], rawOptions: unknown): Promise<void> {
    // Validate options first
    this.validateOptions(rawOptions)
    const options = rawOptions as TOptions

    // Run before middleware
    for (const m of this.middleware) {
      if (m.before)
        await m.before(this, args, options)
    }

    // Execute command
    await this.execute(args, options)

    // Run after middleware
    for (const m of this.middleware) {
      if (m.after)
        await m.after(this, args, options)
    }
  }
}
