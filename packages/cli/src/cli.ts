import type { TelegramAdapter } from '@tg-search/core'

import process from 'node:process'
import { getConfig, useLogger } from '@tg-search/common'
import { createAdapter } from '@tg-search/core'
import { Command as Commander } from 'commander'

import { registry } from './command'
import botCommand from './commands/bot'
import connectCommand from './commands/connect'
import embedCommand from './commands/embed'
import exportCommand from './commands/export'
import importCommand from './commands/import'
import searchCommand from './commands/search'
import syncCommand from './commands/sync'
import watchCommand from './commands/watch'

const logger = useLogger()

/**
 * Register all commands
 */
export function registerCommands() {
  registry.register(botCommand)
  registry.register(connectCommand)
  registry.register(embedCommand)
  registry.register(exportCommand)
  registry.register(importCommand)
  registry.register(searchCommand)
  registry.register(syncCommand)
  registry.register(watchCommand)
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

    // Execute command
    cmd.action(async (options) => {
      try {
        // Initialize Telegram client if needed
        if (command.meta.requiresConnection) {
          const config = getConfig()
          const client = await createAdapter({
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
    })
  }

  // Show help by default
  program.showHelpAfterError()
  program.showSuggestionAfterError()

  return program
}
