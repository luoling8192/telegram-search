import { join, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { useLogger } from '@tg-search/common'
import { findMessagesByChatId, updateChat } from '@tg-search/db'

import { TelegramCommand, CommandError } from '../../types/command'
import { createLoggingMiddleware } from '../../middleware/logging'
import { TelegramUtils } from '../../utils/telegram'
import type { ExportOptions } from './types'
import { convertMessage, generateHtml, generateJson } from './utils'

const logger = useLogger()

/**
 * Export command for exporting messages to file
 */
export class ExportCommand extends TelegramCommand<ExportOptions> {
  meta = {
    name: 'export',
    description: 'Export messages to file',
    options: [
      {
        flags: '-p, --path <path>',
        description: 'Output directory path',
        required: true,
      },
      {
        flags: '-c, --chat-id <id>',
        description: 'Chat ID to export',
      },
      {
        flags: '-f, --format <format>',
        description: 'Export format (json or html)',
        default: 'html',
      },
      {
        flags: '--include-media',
        description: 'Include media files in export',
      },
    ],
  }

  constructor() {
    super()
    this.use(createLoggingMiddleware<ExportOptions>())
  }

  validateOptions(options: unknown): asserts options is ExportOptions {
    if (typeof options !== 'object' || options === null)
      throw new CommandError('Invalid options', 'INVALID_OPTIONS')

    const { path, format } = options as ExportOptions
    if (!path)
      throw new CommandError('Path is required', 'MISSING_PATH')

    if (format && !['json', 'html'].includes(format))
      throw new CommandError('Invalid format', 'INVALID_FORMAT')
  }

  async execute(args: string[], options: ExportOptions): Promise<void> {
    const { path: outputPath, chatId, format = 'html', includeMedia } = options

    if (!outputPath)
      throw new CommandError('Path is required', 'MISSING_PATH')

    // Select chat if not provided
    const targetChatId = chatId || (await TelegramUtils.selectChat(this.getClient())).id

    // Get messages
    const { items: messages } = await findMessagesByChatId(targetChatId)
    if (messages.length === 0) {
      logger.warn('No messages found')
      return
    }

    // Create output directory
    const outputDir = resolve(outputPath)
    await mkdir(outputDir, { recursive: true })

    // Convert messages
    const exportedMessages = await Promise.all(
      messages.map(async (message) => {
        const exported = await convertMessage(message)

        // Fill reply content
        if (exported.replyTo) {
          const { items: [replyMessage] } = await findMessagesByChatId(targetChatId, {
            limit: 1,
            offset: exported.replyTo.id - 1,
          })
          if (replyMessage)
            exported.replyTo.content = replyMessage.content || ''
        }

        return exported
      }),
    )

    // Generate output file
    const outputFile = join(outputDir, `messages.${format}`)
    if (format === 'html')
      await generateHtml(exportedMessages, outputFile)
    else
      await generateJson(exportedMessages, outputFile)

    logger.log(`Exported ${messages.length} messages to ${outputFile}`)

    // TODO: Handle media files
    if (includeMedia) {
      logger.warn('Media export not implemented yet')
    }
  }
} 
