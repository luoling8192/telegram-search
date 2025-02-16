import type { TelegramMessage } from '../adapter/types'

import process from 'node:process'
import { useLogger } from '@tg-search/common'

import { createAdapter } from '../adapter/factory'
import { createMessage } from '../models/message'

const logger = useLogger()

export default async function bot() {
  const token = process.env.BOT_TOKEN
  if (!token) {
    logger.log('BOT_TOKEN is required')
    throw new Error('Missing required configuration')
  }

  // Create adapter
  const adapter = createAdapter({
    type: 'bot',
    token,
  })

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

  // Connect and start listening
  try {
    logger.log('连接到 Telegram...')
    await adapter.connect()
    logger.log('已连接！')

    // Setup message handler
    adapter.onMessage(handleMessage)

    // Keep the process running
    await new Promise(() => {})
  }
  catch (error) {
    await adapter.disconnect()
    throw error
  }
}
