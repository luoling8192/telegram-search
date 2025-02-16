import process from 'node:process'
import { getConfig, useLogger } from '@tg-search/common'
import { Command as Commander } from 'commander'

import { createAdapter } from './adapter/factory'
import { registry } from './commands'
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
function registerCommands() {
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
function setupCli() {
  const program = new Commander()

  // Setup global options
  program
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

          // Connect to Telegram
          logger.log('正在连接到 Telegram...')
          await client.connect()
          logger.log('连接成功')

          // Set client for command
          if ('setClient' in command) {
            (command as { setClient: (client: any) => void }).setClient(client)
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

  return program
}

/**
 * Main entry point
 */
export async function main() {
  try {
    // Register commands
    registerCommands()

    // Setup CLI
    const program = setupCli()

    // Parse command line arguments
    program.parse()
  }
  catch (error) {
    logger.withError(error).error('程序执行失败')
    process.exit(1)
  }
}
