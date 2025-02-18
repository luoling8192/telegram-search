import type { TelegramMessage } from '../../types/telegram'
import type { WatchOptions } from './types'

import { useLogger } from '@tg-search/common'

import { createLoggingMiddleware } from '../../middleware/logging'
import { CommandError, TelegramCommand } from '../../types/command'
import { watchChat } from './utils'

const logger = useLogger()

/**
 * Watch command to watch messages from Telegram
 */
export class WatchCommand extends TelegramCommand<WatchOptions> {
  meta = {
    name: 'watch',
    description: 'Watch messages from Telegram',
    usage: '[options]',
    options: [
      {
        flags: '-c, --chat-id <id>',
        description: '会话 ID',
      },
    ],
  }

  constructor() {
    super()
    this.use(createLoggingMiddleware<WatchOptions>())
  }

  validateOptions(options: unknown): asserts options is WatchOptions {
    if (typeof options !== 'object' || options === null)
      throw new CommandError('Invalid options', 'INVALID_OPTIONS')
  }

  async execute(_args: string[], options: WatchOptions): Promise<void> {
    const { chatId } = options

    if (!chatId)
      throw new CommandError('会话 ID 是必需的', 'MISSING_CHAT_ID')

    try {
      // Get folders from Telegram
      logger.log('获取文件夹列表...')
      const folders = await this.client.getFolders()
      logger.log(`获取到 ${folders.length} 个文件夹`)

      // Find folder by chat ID
      const folder = folders.find(f => f.id === chatId)
      if (!folder)
        throw new CommandError('会话未找到', 'CHAT_NOT_FOUND')

      // Watch messages
      logger.log(`开始监听 "${folder.title}" 文件夹...`)
      await watchChat(chatId, folder.title, (callback: (message: TelegramMessage) => void) => {
        this.client.onMessage(callback)
      })
    }
    catch (error) {
      logger.withError(error).error('监听失败')
      throw error
    }
  }
}

// Register command
export default new WatchCommand()
