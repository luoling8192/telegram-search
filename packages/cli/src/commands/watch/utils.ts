import type { TelegramMessage } from '../../types/telegram'

import { useLogger } from '@tg-search/common'
import { createMessage } from '@tg-search/db'

const logger = useLogger()

/**
 * Get folder choices for selection
 */
export function getFolderChoices(folders: Array<{ id: number, emoji?: string, title: string }>) {
  return folders.map(folder => ({
    name: `${folder.emoji || ''} ${folder.title}`,
    value: folder.id,
  }))
}

/**
 * Get chat choices for selection
 */
export function getChatChoices(dialogs: Array<{ id: number, type: string, name: string, unreadCount: number }>) {
  return dialogs.map(dialog => ({
    name: `[${dialog.type}] ${dialog.name} (${dialog.unreadCount} 条未读)`,
    value: dialog.id,
  }))
}

/**
 * Watch messages from a chat
 */
export async function watchChat(
  chatId: number,
  folderTitle: string,
  onMessage: (callback: (message: TelegramMessage) => void) => void,
): Promise<void> {
  logger.log(`开始监听 "${folderTitle}" 文件夹...`)
  let count = 0

  // Setup message handler
  const messageHandler = async (message: TelegramMessage) => {
    // Only handle messages from selected chat
    if (message.chatId !== chatId)
      return

    // Only handle text messages
    if (message.type !== 'text') {
      logger.log(`[${new Date().toLocaleString()}] 跳过非文本消息: ${message.type}`)
      return
    }

    try {
      await createMessage({
        id: message.id,
        chatId: message.chatId,
        type: message.type,
        content: message.content || '',
        fromId: message.fromId,
        replyToId: message.replyToId,
        forwardFromChatId: message.forwardFromChatId,
        forwardFromMessageId: message.forwardFromMessageId,
        views: message.views,
        forwards: message.forwards,
        createdAt: message.createdAt,
      })
      count++
      logger.log(`[${new Date().toLocaleString()}] 已保存 ${count} 条新消息`)
    }
    catch (error) {
      logger.withError(error).error('保存消息失败:')
    }
  }

  // Register message handler
  onMessage(messageHandler)

  // Keep the process running
  logger.log('按 Ctrl+C 停止监听')
}
