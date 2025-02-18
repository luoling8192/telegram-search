import type { ExportedMessage } from './types'

import { writeFile } from 'node:fs/promises'
import { useLogger } from '@tg-search/common'
import { findMessagesByChatId, getAllFolders } from '@tg-search/db'

const logger = useLogger()

/**
 * Export messages from a chat
 */
export async function exportMessages(chatId: number): Promise<ExportedMessage[]> {
  // Get chat info
  const folders = await getAllFolders()
  const chat = folders.find(f => f.id === chatId)
  if (!chat)
    throw new Error('Chat not found')

  // Get messages
  const { items: messages } = await findMessagesByChatId(chatId)
  if (messages.length === 0)
    throw new Error('No messages found')

  // Transform messages
  return messages.map(message => ({
    id: message.id,
    chatId: message.chatId,
    type: message.type,
    content: message.content || '',
    createdAt: message.createdAt,
    views: message.views || undefined,
    forwards: message.forwards || undefined,
    chat: {
      id: chat.id,
      title: chat.title,
    },
    from: message.fromId
      ? {
          id: message.fromId,
          name: message.fromName || '',
          avatar: message.fromAvatar || undefined,
        }
      : undefined,
    replyTo: message.replyToId ? {
      id: message.replyToId,
      content: '', // TODO: Get reply message content
    } : undefined,
    forwardFrom: message.forwardFromChatId && message.forwardFromMessageId
      ? {
          chatId: message.forwardFromChatId,
          messageId: message.forwardFromMessageId,
        }
      : undefined,
    media: message.mediaInfo ? {
      type: message.mediaInfo.type,
      url: '', // TODO: Get media URL
      fileName: message.mediaInfo.fileName,
      fileSize: message.mediaInfo.fileSize,
      width: message.mediaInfo.width,
      height: message.mediaInfo.height,
      duration: message.mediaInfo.duration,
      thumbnail: message.mediaInfo.thumbnail ? {
        url: '', // TODO: Get thumbnail URL
        width: message.mediaInfo.thumbnail.width,
        height: message.mediaInfo.thumbnail.height,
      } : undefined,
    } : undefined,
  }))
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
