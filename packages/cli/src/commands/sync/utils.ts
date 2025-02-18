import type { TelegramChat, TelegramFolder } from '../../types/telegram'
import type { SyncProgressContext } from './types'

import { useLogger } from '@tg-search/common'
import { deleteAllChats, deleteAllFolders, updateChat, updateFolder } from '@tg-search/db'

const logger = useLogger()

/**
 * Clear existing data from database
 */
export async function clearExistingData(): Promise<void> {
  logger.debug('清理现有数据...')
  await deleteAllFolders()
  await deleteAllChats()
  logger.debug('数据清理完成')
}

/**
 * Sync folders from Telegram to database
 */
export async function syncFolders(
  folders: TelegramFolder[],
  context: SyncProgressContext,
): Promise<number> {
  let failedCount = 0

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i]
    try {
      const result = await updateFolder(folder)
      logger.debug(`已同步文件夹: ${folder.emoji || ''} ${folder.title} (ID: ${folder.id})`)
      if (!result || result.length === 0) {
        logger.warn(`文件夹 ${folder.title} 同步失败`)
        failedCount++
      }
    }
    catch (error) {
      logger.withError(error).warn(`同步文件夹失败: ${folder.title}`)
      failedCount++
    }

    context.onFolderProgress(i + 1, folders.length)
  }

  return failedCount
}

/**
 * Sync chats from Telegram to database
 */
export async function syncChats(
  chats: Array<TelegramChat & { folderId?: number }>,
  context: SyncProgressContext,
): Promise<number> {
  let failedCount = 0
  const total = chats.length

  logger.log(`开始同步 ${total} 个会话...`)
  for (let i = 0; i < total; i++) {
    const chat = chats[i]
    try {
      const result = await updateChat(chat)
      logger.log(
        `[${i + 1}/${total}] 同步会话: [${chat.type}] ${chat.title} ` +
        `${chat.folderId ? `(文件夹 ID: ${chat.folderId})` : '(无文件夹)'} ` +
        `${chat.messageCount ? `(${chat.messageCount} 条消息)` : ''}`
      )
      if (!result || result.length === 0) {
        logger.warn(`会话 ${chat.title} 同步失败`)
        failedCount++
      }
    }
    catch (error) {
      logger.withError(error).warn(`同步会话失败: ${chat.title}`)
      failedCount++
    }

    context.onChatProgress(i + 1, total)
  }

  return failedCount
}
