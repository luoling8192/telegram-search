import process from 'node:process'
import { initLogger, useLogger } from '@tg-search/common'
import { Command } from 'commander'

import { initConfig } from './composable/config'
import { initDB } from './composable/db'

async function main() {
  // Initialize logger and config
  initLogger()
  initConfig()
  initDB()

  const logger = useLogger()

  // Global error handler
  process.on('unhandledRejection', (error) => {
    logger.withError(error).error('Unhandled promise rejection:')
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

  // Bot command - Start a Telegram bot to collect messages
  const bot = new Command('bot')
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
  const search = new Command('search')
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
  const watch = new Command('watch')
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
  const exportCmd = new Command('export')
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

  // Import command - Import messages from HTML export files
  const importCmd = new Command('import')
    .description('Import messages from HTML export files')
    .requiredOption('-c, --chat-id <id>', 'Chat ID')
    .requiredOption('-p, --path <path>', 'Path to HTML export files')
    .option('--no-embedding', 'Skip embedding generation')
    .action(async (options) => {
      try {
        const mod = await import('./commands/import')
        await mod.default(options.chatId, options.path, { noEmbedding: !options.embedding })
      }
      catch (error) {
        logger.withError(error).error('Import 命令执行失败:')
        process.exit(1)
      }
    })

  // Embed command - Generate embeddings for messages
  const embed = new Command('embed')
    .description('Generate embeddings for messages that do not have them')
    .option('-b, --batch-size <size>', 'Batch size for processing', '100')
    .option('-c, --chat-id <id>', 'Only process messages from this chat')
    .action(async (options) => {
      try {
        const mod = await import('./commands/embed')
        await mod.default({
          batchSize: Number(options.batchSize),
          chatId: options.chatId ? Number(options.chatId) : undefined,
        })
      }
      catch (error) {
        logger.withError(error).error('Embed 命令执行失败:')
        process.exit(1)
      }
    })

  program
    .name('tg-search')
    .description('Telegram Search CLI')
    .version('1.0.0')
    .option('-e, --env <path>', 'Path to .env file')
    .addCommand(bot)
    .addCommand(search)
    .addCommand(watch)
    .addCommand(exportCmd)
    .addCommand(importCmd)
    .addCommand(embed)

  // Add help text for no command
  program.addHelpText('after', `
示例:
  $ tg-search bot            启动 Telegram 机器人
  $ tg-search watch         监听 Telegram 消息
  $ tg-search search        搜索消息
  $ tg-search embed         生成消息向量嵌入
  $ tg-search import        导入消息
`)

  try {
    await program.parseAsync()
  }
  catch (error) {
    logger.withError(error).error('命令执行失败')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('程序执行失败:', error)
  process.exit(1)
})
