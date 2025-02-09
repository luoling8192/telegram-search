import process from 'node:process'
import { initLogger, useLogger } from '@tg-search/common'
import { Command } from 'commander'

import { initConfig } from './composable/config'

// Initialize logger and config
initLogger()
initConfig()

const logger = useLogger()

// Global error handler
process.on('unhandledRejection', (error) => {
  logger.log('Unhandled promise rejection:', String(error))
})

// Graceful shutdown handler
process.on('SIGINT', () => {
  logger.log('正在关闭应用...')
  process.exit(0)
})

// Exit handler
process.on('exit', (code) => {
  logger.log(`应用已退出，退出码: ${code}`)
})

const program = new Command()

program
  .name('tg-search')
  .description('Telegram Search CLI')
  .version('1.0.0')

// Bot command - Start a Telegram bot to collect messages
program
  .command('bot')
  .description('Start a Telegram bot to collect messages')
  .action(async () => {
    try {
      const mod = await import('./commands/bot')
      await mod.default()
    }
    catch (error) {
      logger.withError(error).error('Bot 命令执行失败:')
      process.exit(1)
    }
  })

// Search command - Search messages in Telegram chats
program
  .command('search')
  .description('Search messages in Telegram chats')
  .action(async () => {
    try {
      const mod = await import('./commands/search')
      await mod.default()
    }
    catch (error) {
      logger.withError(error).error('Search 命令执行失败:')
      process.exit(1)
    }
  })

// Watch command - Watch messages in Telegram chats
program
  .command('watch')
  .description('Watch messages in Telegram chats')
  .action(async () => {
    try {
      const mod = await import('./commands/watch')
      await mod.default()
    }
    catch (error) {
      logger.withError(error).error('Watch 命令执行失败:')
      process.exit(1)
    }
  })

// Export command - Export messages from Telegram chats
program
  .command('export')
  .description('Export messages from Telegram chats')
  .action(async () => {
    try {
      const mod = await import('./commands/export')
      await mod.default()
    }
    catch (error) {
      logger.withError(error).error('Export 命令执行失败:')
      process.exit(1)
    }
  })

program.parse()
