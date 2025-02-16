import type { TelegramMessage } from '../../../core/src/adapter/types'

import { useLogger } from '@tg-search/common'
import { createMessage } from '@tg-search/db'

import { TelegramCommand } from '../command'

const logger = useLogger()

/**
 * Bot command to run a Telegram bot
 */
export class BotCommand extends TelegramCommand {
  meta = {
    name: 'bot',
    description: 'Run a Telegram bot',
    isBackground: true,
  }

  async execute(_args: string[], _options: Record<string, any>): Promise<void> {
    // Message handler
    const handleMessage = async (message: TelegramMessage) => {
      logger.log('收到消息:', message)

      try {
        // Save to database
        const result = await createMessage({
          id: message.id,
          chatId: message.chatId,
          type: message.type,
          content: message.content,
          fromId: message.fromId,
          replyToId: message.replyToId,
          forwardFromChatId: message.forwardFromChatId,
          forwardFromMessageId: message.forwardFromMessageId,
          views: message.views,
          forwards: message.forwards,
          createdAt: message.createdAt,
        })
        logger.log('消息已保存到数据库:', result)
      }
      catch (error) {
        logger.withError(error).error('保存消息失败:')
      }
    }

    // Setup message handler
    this.getClient().onMessage(handleMessage)

    // Keep the process running
    logger.log('按 Ctrl+C 停止监听')
    await new Promise(() => {})
  }
}

// Register command
export default new BotCommand()
