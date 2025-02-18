import type { ImportOptions } from './types'

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { createMessage, getAllChats, refreshMessageStats, updateChat } from '@tg-search/db'
import cliProgress from 'cli-progress'
import { glob } from 'glob'

import { createLoggingMiddleware } from '../../middleware/logging'
import { CommandError, TelegramCommand } from '../../types/command'
import { TelegramUtils } from '../../utils/telegram'
import { parseHtmlFile } from './utils'

const logger = useLogger()

// Save original stdout.write
const originalStdoutWrite = process.stdout.write.bind(process.stdout)
let progressOutput = ''

// Override stdout.write to capture progress bar output
process.stdout.write = ((data: string | Uint8Array) => {
  const str = data.toString()
  if (str.includes('|')) {
    // This is progress bar output
    progressOutput = str
    // Clear line and move to start
    originalStdoutWrite('\x1B[2K\r')
    // Print progress at bottom of terminal
    const terminalHeight = process.stdout.rows || 24
    originalStdoutWrite(`\x1B[${terminalHeight};0H`)
    originalStdoutWrite(progressOutput)
    // Move cursor back up
    originalStdoutWrite(`\x1B[${terminalHeight - 1};0H`)
  }
  else {
    // This is normal output
    originalStdoutWrite(data)
  }
  return true
}) as typeof process.stdout.write

/**
 * Format file size to human readable string
 */
function formatFileSize(size: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let unit = 0
  while (size > 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size.toFixed(2)} ${units[unit]}`
}

/**
 * Import command for importing messages from HTML export
 */
export class ImportCommand extends TelegramCommand<ImportOptions> {
  meta = {
    name: 'import',
    description: 'Import messages from HTML export',
    options: [
      {
        flags: '-p, --path <path>',
        description: 'Path to HTML export directory',
        required: true,
      },
      {
        flags: '--no-embedding',
        description: 'Disable embedding generation',
      },
    ],
    requiresConnection: true,
  }

  constructor() {
    super()
    this.use(createLoggingMiddleware<ImportOptions>())
  }

  validateOptions(options: unknown): asserts options is ImportOptions {
    if (typeof options !== 'object' || options === null)
      throw new CommandError('Invalid options', 'INVALID_OPTIONS')

    const { path } = options as ImportOptions
    if (!path)
      throw new CommandError('Path is required', 'MISSING_PATH')
  }

  async execute(args: string[], options: ImportOptions): Promise<void> {
    const { path: exportPath, noEmbedding } = options

    if (!exportPath)
      throw new CommandError('Path is required', 'MISSING_PATH')

    // Find all message files
    const messageFiles = await glob('**/messages*.html', {
      cwd: resolve(exportPath),
      absolute: true,
    })

    if (messageFiles.length === 0) {
      logger.warn('No message files found')
      return
    }

    // Parse first file to get chat info
    logger.debug('解析第一个文件以获取聊天信息...')
    const firstFile = messageFiles[0]
    const firstMessages = await parseHtmlFile(firstFile)
    if (firstMessages.length === 0) {
      logger.warn('未在第一个文件中找到消息')
      return
    }

    // Get source chat name from file path
    const sourceChatName = firstFile.split('/').slice(-2)[0].replace('ChatExport_', '').split(' ')[1]
    logger.debug(`从文件路径获取到源聊天名称：${sourceChatName}`)

    // Ask if user wants to update chat list
    const shouldUpdateChats = await input.confirm({
      message: '是否要从 Telegram 更新会话列表？',
      default: false,
    })

    let targetChat
    if (shouldUpdateChats) {
      // Get chats from Telegram
      logger.debug('正在从 Telegram 获取会话列表...')
      const telegramChats = await this.getClient().getChats()
      logger.debug(`获取到 ${telegramChats.length} 个会话`)

      // Update chats in database
      for (const chat of telegramChats) {
        await updateChat({
          id: chat.id,
          type: chat.type,
          title: chat.title,
          lastSyncTime: new Date(),
        })
      }

      // Let user select from updated list
      targetChat = await TelegramUtils.selectChat(this.getClient())
    }
    else {
      // Get chats from database
      logger.debug('正在从数据库获取会话列表...')
      const existingChats = await getAllChats()
      if (existingChats.length === 0) {
        logger.warn('数据库中没有会话，正在从 Telegram 获取...')
        const telegramChats = await this.getClient().getChats()
        logger.debug(`获取到 ${telegramChats.length} 个会话`)

        // Update chats in database
        for (const chat of telegramChats) {
          await updateChat({
            id: chat.id,
            type: chat.type,
            title: chat.title,
            lastSyncTime: new Date(),
          })
        }
      }

      // Let user select from database
      targetChat = await TelegramUtils.selectChat(this.getClient())
    }

    logger.debug(`已选择目标会话：${targetChat.title} (${targetChat.id})`)

    // Ask about embeddings if not specified
    const shouldGenerateEmbeddings = noEmbedding !== undefined
      ? !noEmbedding
      : await input.confirm({
        message: '是否生成向量嵌入（用于语义搜索）？',
        default: false,
      })

    // Process each file
    let totalMessages = 0

    // Clear screen and hide cursor
    process.stdout.write('\x1B[2J\x1B[0f\x1B[?25l')

    const multibar = new cliProgress.MultiBar({
      format: '{bar} {percentage}% | {value}/{total} | {title}',
      hideCursor: true,
      clearOnComplete: false,
      noTTYOutput: false,
      forceRedraw: true,
      linewrap: false,
      stream: process.stdout,
      barCompleteChar: '=',
      barIncompleteChar: '-',
    })

    try {
      // Create progress bars
      const fileBar = multibar.create(messageFiles.length, 0, { title: '处理文件进度' })
      let embeddingBar: cliProgress.SingleBar | undefined

      for (let i = 0; i < messageFiles.length; i++) {
        const file = messageFiles[i]
        const fileSize = (await readFile(file)).length
        logger.debug(`开始处理：${file.split('/').slice(-2).join('/')} (${formatFileSize(fileSize)})`)

        // Parse messages
        const messages = await parseHtmlFile(file)
        if (messages.length === 0) {
          logger.warn('文件中没有消息')
          fileBar.increment()
          continue
        }

        // Set chat ID for all messages
        for (const message of messages) {
          message.chatId = targetChat.id
        }

        // Save all messages at once
        await createMessage(messages)

        // Generate embeddings in batch
        if (shouldGenerateEmbeddings) {
          const embedding = new EmbeddingService()
          const contents = messages.map(m => m.content)

          // Create embedding progress bar if not exists
          if (!embeddingBar) {
            embeddingBar = multibar.create(messageFiles.length, 0, { title: '生成向量嵌入进度' })
          }

          // Generate embeddings in batch
          const embeddingBatchSize = 50
          for (let j = 0; j < contents.length; j += embeddingBatchSize) {
            const batch = contents.slice(j, j + embeddingBatchSize)
            await embedding.generateEmbeddings(batch)
          }
        }

        totalMessages += messages.length
        fileBar.increment()
        logger.debug(`已导入 ${messages.length} 条消息，总计 ${totalMessages} 条`)
      }

      // Stop progress bars
      multibar.stop()
      console.log() // Add a newline after progress bars

      // Update chat info
      await updateChat({
        id: targetChat.id,
        type: targetChat.type,
        title: targetChat.title,
        lastSyncTime: new Date(),
        messageCount: totalMessages,
      })

      // Refresh message stats
      await refreshMessageStats(targetChat.id)

      logger.log(`导入完成。从"${sourceChatName}"导入了 ${totalMessages} 条消息到"${targetChat.title}"`)
    }
    finally {
      // Restore cursor and stdout
      process.stdout.write = originalStdoutWrite
      process.stdout.write('\x1B[?25h')
    }
  }
}
