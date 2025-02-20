import type { ExportedMessage } from './types'
import type { TelegramAdapter, GetMessagesOptions } from '../../types/telegram'
import type { MessageType } from '@tg-search/db'

import { writeFile } from 'node:fs/promises'
import { useLogger } from '@tg-search/common'
import { createMessageBatch, findMessagesByChatId, getAllChats } from '@tg-search/db'
import cliProgress from 'cli-progress'

const logger = useLogger()

interface ExportOptions {
  messageTypes?: MessageType[]
  startTime?: Date
  endTime?: Date
  limit?: number
  batchSize?: number
  skipMedia?: boolean
}

/**
 * Export messages from a chat with progress bar
 */
export async function exportMessages(
  chatId: number,
  client: TelegramAdapter,
  options: ExportOptions = {},
): Promise<ExportedMessage[]> {
  // Get chat info
  const chats = await getAllChats()
  const chat = chats.find(c => c.id === chatId)
  if (!chat)
    throw new Error('Chat not found')

  // Create progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '{bar} {percentage}% | {value}/{total} 条消息',
    barCompleteChar: '=',
    barIncompleteChar: '-',
  })

  // Get messages from Telegram
  logger.log('正在从 Telegram 获取消息...')
  const messages: ExportedMessage[] = []
  let errorCount = 0
  let count = 0

  try {
    // Start progress bar with initial total
    progressBar.start(chat.messageCount || 100, 0)

    // Get messages with options
    const getMessagesOptions: GetMessagesOptions = {
      skipMedia: options.skipMedia,
      startTime: options.startTime,
      endTime: options.endTime,
      limit: options.limit,
      messageTypes: options.messageTypes,
    }

    for await (const message of client.getMessages(chatId, getMessagesOptions)) {
      try {
        // Process message in batches
        if (options.batchSize && messages.length >= options.batchSize) {
          await createMessageBatch(messages.splice(0, options.batchSize))
          logger.debug(`已保存 ${count + 1} - ${count + options.batchSize} 条消息`)
        }

        // Add to export list
        messages.push({
          id: message.id,
          chatId: message.chatId,
          type: message.type,
          content: message.content || '',
          createdAt: message.createdAt,
          views: message.views,
          forwards: message.forwards,
          chat: {
            id: chat.id,
            title: chat.title,
          },
          from: message.fromId && message.fromName
            ? {
                id: message.fromId,
                name: message.fromName,
                avatar: message.fromAvatar,
              }
            : undefined,
          replyTo: message.replyToId ? {
            id: message.replyToId,
            content: '', // Will be filled later if needed
          } : undefined,
          forwardFrom: message.forwardFromChatId && message.forwardFromMessageId
            ? {
                chatId: message.forwardFromChatId,
                messageId: message.forwardFromMessageId,
              }
            : undefined,
          media: message.mediaInfo ? {
            type: message.mediaInfo.type,
            url: '', // Will be filled later if needed
            fileName: message.mediaInfo.fileName,
            fileSize: message.mediaInfo.fileSize,
            width: message.mediaInfo.width,
            height: message.mediaInfo.height,
            duration: message.mediaInfo.duration,
            thumbnail: message.mediaInfo.thumbnail ? {
              url: '', // Will be filled later if needed
              width: message.mediaInfo.thumbnail.width,
              height: message.mediaInfo.thumbnail.height,
            } : undefined,
          } : undefined,
        })

        count++
        progressBar.increment()
      }
      catch (error) {
        logger.withError(error).warn(`消息 ${message.id} 处理失败`)
        errorCount++
      }
    }

    // Process remaining messages
    if (messages.length > 0 && options.batchSize) {
      await createMessageBatch(messages)
      logger.debug(`已保存剩余 ${messages.length} 条消息`)
    }
  }
  catch (error) {
    logger.withError(error).error('获取消息失败')
    throw error
  }
  finally {
    progressBar.stop()
  }

  if (count === 0) {
    logger.warn('该会话没有消息记录')
    return []
  }

  if (errorCount > 0) {
    logger.warn(`${errorCount} 条消息处理失败`)
  }

  logger.log(`已导出 ${count} 条消息`)
  return messages
}

/**
 * Export messages to JSON file
 */
export async function exportToJson(messages: ExportedMessage[], path: string): Promise<void> {
  await writeFile(path, JSON.stringify(messages, null, 2))
}

/**
 * Export messages to HTML file
 */
export async function exportToHtml(messages: ExportedMessage[], path: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Telegram Messages</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .message {
      margin-bottom: 20px;
      padding: 10px;
      border-radius: 5px;
      background-color: #f5f5f5;
    }
    .message-header {
      margin-bottom: 10px;
      color: #666;
    }
    .message-content {
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>Telegram Messages</h1>
  ${messages.map(message => `
  <div class="message">
    <div class="message-header">
      ${message.from ? `From: ${message.from.name}` : ''}
      ${message.createdAt.toLocaleString()}
    </div>
    <div class="message-content">${message.content}</div>
  </div>
  `).join('\n')}
</body>
</html>
`
  await writeFile(path, html)
}
