import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Message } from '@tg-search/db'
import type { ExportedMessage } from './types'

/**
 * Convert message to export format
 */
export async function convertMessage(message: Message): Promise<ExportedMessage> {
  const {
    id,
    chatId,
    type,
    content,
    createdAt,
    fromId,
    fromName,
    fromAvatar,
    replyToId,
    forwardFromChatId,
    forwardFromMessageId,
    views,
    forwards,
    mediaInfo,
  } = message

  return {
    id,
    chatId,
    type,
    content,
    createdAt,
    views,
    forwards,
    from: fromId
      ? {
          id: fromId,
          name: fromName || '',
          avatar: fromAvatar,
        }
      : undefined,
    replyTo: replyToId
      ? {
          id: replyToId,
          content: '', // Will be filled later
        }
      : undefined,
    forwardFrom: forwardFromChatId && forwardFromMessageId
      ? {
          chatId: forwardFromChatId,
          messageId: forwardFromMessageId,
        }
      : undefined,
    media: mediaInfo
      ? {
          type: mediaInfo.type,
          url: mediaInfo.fileId,
          fileName: mediaInfo.fileName,
          fileSize: mediaInfo.fileSize,
          width: mediaInfo.width,
          height: mediaInfo.height,
          duration: mediaInfo.duration,
          thumbnail: mediaInfo.thumbnail
            ? {
                url: mediaInfo.thumbnail.fileId,
                width: mediaInfo.thumbnail.width,
                height: mediaInfo.thumbnail.height,
              }
            : undefined,
        }
      : undefined,
  }
}

/**
 * Generate HTML export
 */
export async function generateHtml(messages: ExportedMessage[], outputPath: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Telegram Chat Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      margin: 0;
      padding: 20px;
    }
    .message {
      margin-bottom: 20px;
      padding: 10px;
      border-radius: 8px;
      background: #f5f5f5;
    }
    .message-header {
      margin-bottom: 5px;
      color: #666;
    }
    .message-content {
      white-space: pre-wrap;
    }
    .message-footer {
      margin-top: 5px;
      color: #999;
      font-size: 0.9em;
    }
    .media {
      margin-top: 10px;
    }
    .media img, .media video {
      max-width: 100%;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="messages">
    ${messages.map(message => `
      <div class="message">
        <div class="message-header">
          ${message.from ? `<strong>${message.from.name}</strong>` : 'Unknown'}
          <span class="date">${message.createdAt.toLocaleString()}</span>
        </div>
        <div class="message-content">${message.content}</div>
        ${message.media ? `
          <div class="media">
            ${message.media.type === 'photo' || message.media.type === 'sticker'
              ? `<img src="${message.media.url}" alt="Media" ${message.media.width ? `width="${message.media.width}"` : ''} ${message.media.height ? `height="${message.media.height}"` : ''}>`
              : message.media.type === 'video'
                ? `<video src="${message.media.url}" controls ${message.media.width ? `width="${message.media.width}"` : ''} ${message.media.height ? `height="${message.media.height}"` : ''}></video>`
                : `<a href="${message.media.url}">${message.media.fileName || 'Download file'}</a>`
            }
          </div>
        ` : ''}
        <div class="message-footer">
          ${message.views ? `${message.views} views` : ''}
          ${message.forwards ? `${message.forwards} forwards` : ''}
        </div>
      </div>
    `).join('\n')}
  </div>
</body>
</html>
  `

  await writeFile(outputPath, html, 'utf-8')
}

/**
 * Generate JSON export
 */
export async function generateJson(messages: ExportedMessage[], outputPath: string): Promise<void> {
  const json = JSON.stringify(messages, null, 2)
  await writeFile(outputPath, json, 'utf-8')
} 
