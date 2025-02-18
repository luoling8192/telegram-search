import type { TelegramAdapter } from '@tg-search/core'

import process from 'node:process'
import { getConfig, useLogger } from '@tg-search/common'
import { createAdapter } from '@tg-search/core'
import { Command as Commander } from 'commander'

import { registry } from './command'
import { BotCommand } from './commands/bot'
import { ConnectCommand } from './commands/connect'
import { EmbedCommand } from './commands/embed'
import { ExportCommand } from './commands/export'
import { ImportCommand } from './commands/import'
import { SearchCommand } from './commands/search'
import { SyncCommand } from './commands/sync'
import { WatchCommand } from './commands/watch'

const logger = useLogger()

/**
 * Register all commands
 */
export function registerCommands() {
  registry.register(new BotCommand())
  registry.register(new ConnectCommand())
  registry.register(new EmbedCommand())
  registry.register(new ExportCommand())
  registry.register(new ImportCommand())
  registry.register(new SearchCommand())
  registry.register(new SyncCommand())
  registry.register(new WatchCommand())
}

/**
 * Setup command line interface
 */
export function setupCli() {
  const program = new Commander()

  // Setup global options
  program
    .name('tg-search')
    .version('1.0.0')
    .description('Telegram Search CLI')
    .option('-d, --debug', 'Enable debug mode')

  // Register commands
  for (const command of registry.getAll()) {
    const cmd = program
      .command(command.meta.name)
      .description(command.meta.description)

    if (command.meta.usage) {
      cmd.usage(command.meta.usage)
    }

    // Add command options
    if (command.meta.options) {
      for (const option of command.meta.options) {
        cmd.option(option.flags, option.description)
      }
    }

    // Execute command
    cmd.action(async (options) => {
      let client: TelegramAdapter | undefined

      try {
        // Initialize Telegram client if needed
        if (command.meta.requiresConnection) {
          const config = getConfig()
          client = await createAdapter({
            type: 'client',
            apiId: Number(config.apiId),
            apiHash: config.apiHash,
            phoneNumber: config.phoneNumber,
          })

          // Set client for command
          if ('setClient' in command) {
            (command as { setClient: (client: TelegramAdapter) => void }).setClient(client)
          }

          // Connect to Telegram
          logger.log('正在连接到 Telegram...')
          try {
            await client.connect()
          }
          catch (error) {
            // If connection failed, try to use connect command
            if (error instanceof Error && (error.message === 'Code is required' || error.message === '2FA password is required')) {
              const connectCommand = new ConnectCommand()
              connectCommand.setClient(client)
              await connectCommand.execute([], {})
            }
            else {
              throw error
            }
          }
        }

        // Execute command
        await command.execute(cmd.args, options)
      }
      catch (error) {
        logger.withError(error).error('命令执行失败')
        process.exit(1)
      }
      finally {
        // Disconnect client if exists
        if (client) {
          logger.debug('正在断开连接...')
          await client.disconnect()
          logger.debug('连接已断开')
        }
        process.exit(0)
      }
    })
  }

  // Show help by default
  program.showHelpAfterError()
  program.showSuggestionAfterError()

  return program
}
