import type { ExportOptions } from './types'

import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'

import { createLoggingMiddleware } from '../../middleware/logging'
import { CommandError, TelegramCommand } from '../../types/command'
import { TelegramUtils } from '../../utils/telegram'
import { exportMessages, exportToHtml, exportToJson } from './utils'

const logger = useLogger()

/**
 * Export command for exporting messages to file or database
 */
export class ExportCommand extends TelegramCommand<ExportOptions> {
  meta = {
    name: 'export',
    description: 'Export messages to file or database',
    usage: '[options]',
    options: [
      {
        flags: '-c, --chat-id <id>',
        description: '会话 ID',
      },
      {
        flags: '-f, --format <format>',
        description: '导出格式 (json, html, 或 db)',
        default: 'db',
      },
      {
        flags: '-p, --path <path>',
        description: '输出目录路径 (json/html 格式必需)',
      },
      {
        flags: '--include-media',
        description: '包含媒体文件',
      },
    ],
    requiresConnection: true,
  }

  constructor() {
    super()
    this.use(createLoggingMiddleware<ExportOptions>())
  }

  validateOptions(options: unknown): asserts options is ExportOptions {
    if (typeof options !== 'object' || options === null)
      throw new CommandError('Invalid options', 'INVALID_OPTIONS')

    const { path, format } = options as ExportOptions

    // Only validate path if format is json or html
    if (format && format !== 'db') {
      if (!path)
        throw new CommandError('导出到文件时需要指定路径', 'MISSING_PATH')
      if (!['json', 'html'].includes(format))
        throw new CommandError('不支持的导出格式', 'INVALID_FORMAT')
    }
  }

  async execute(_args: string[], options: ExportOptions): Promise<void> {
    const { path: outputPath, chatId: inputChatId, format = 'db', includeMedia } = options

    try {
      // Get chat ID from input or selection
      let targetChatId = inputChatId
      if (!targetChatId) {
        const chat = await TelegramUtils.selectChat(this.getClient())
        targetChatId = chat.id
      }

      // If format not specified, ask user
      const exportFormat = format || await input.select({
        message: '请选择导出格式：',
        choices: [
          { name: '数据库', value: 'db' },
          { name: 'JSON 文件', value: 'json' },
          { name: 'HTML 文件', value: 'html' },
        ],
      })

      // Export messages
      const messages = await exportMessages(targetChatId)

      if (exportFormat === 'db') {
        logger.log(`已导出 ${messages.length} 条消息到数据库`)
        return
      }

      // For file exports, ensure we have a path
      if (!outputPath) {
        throw new CommandError('导出到文件时需要指定路径', 'MISSING_PATH')
      }

      // Create output directory
      const outputDir = resolve(outputPath)
      await mkdir(outputDir, { recursive: true })

      // Generate output file
      const outputFile = join(outputDir, `messages.${exportFormat}`)
      if (exportFormat === 'html')
        await exportToHtml(messages, outputFile)
      else
        await exportToJson(messages, outputFile)

      logger.log(`已导出 ${messages.length} 条消息到 ${outputFile}`)

      // TODO: Handle media files
      if (includeMedia) {
        logger.warn('暂不支持导出媒体文件')
      }
    }
    catch (error) {
      logger.withError(error).error('导出失败')
      throw error
    }
  }
}

// Register command
export default new ExportCommand()
