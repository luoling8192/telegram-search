import type { SyncOptions } from './types'

import { useLogger } from '@tg-search/common'

import { createLoggingMiddleware } from '../../middleware/logging'
import { CommandError, TelegramCommand } from '../../types/command'
import { clearExistingData, syncChats, syncFolders } from './utils'

const logger = useLogger()

/**
 * Sync command to sync folders and chats from Telegram
 */
export class SyncCommand extends TelegramCommand<SyncOptions> {
  meta = {
    name: 'sync',
    description: 'Sync folders and chats from Telegram',
    usage: '[options]',
    options: [
      {
        flags: '-c, --clear',
        description: '清理现有数据',
      },
    ],
    requiresConnection: true,
  }

  constructor() {
    super()
    this.use(createLoggingMiddleware<SyncOptions>())
  }

  validateOptions(options: unknown): asserts options is SyncOptions {
    if (typeof options !== 'object' || options === null)
      throw new CommandError('Invalid options', 'INVALID_OPTIONS')
  }

  async execute(_args: string[], options: SyncOptions): Promise<void> {
    const { clear } = options

    try {
      // Clear existing data if requested
      if (clear) {
        logger.log('清理现有数据...')
        await clearExistingData()
        logger.log('数据清理完成')
      }

      // Get folders and chats from Telegram
      logger.log('获取文件夹和会话列表...')
      const [folders, chats] = await Promise.all([
        this.getClient().getFolders(),
        this.getClient().getChats(),
      ])
      logger.log(`获取到 ${folders.length} 个文件夹, ${chats.length} 个会话`)

      // Sync folders
      logger.log('同步文件夹...')
      const failedFolders = await syncFolders(folders.map(folder => ({
        id: folder.id,
        title: folder.title,
        emoji: folder.emoji || undefined,
      })), {
        onFolderProgress: (_current, _total) => {
          // logger.debug(`同步文件夹进度: ${current}/${total}`)
        },
        onChatProgress: (_current, _total) => {
          // logger.debug(`同步会话进度: ${current}/${total}`)
        },
      })

      // Sync chats
      logger.log('同步会话...')
      const failedChats = await syncChats(chats.map(chat => ({
        id: chat.id,
        type: chat.type,
        title: chat.title,
        folderId: chat.folderId || undefined,
        lastSyncTime: chat.lastSyncTime,
        messageCount: chat.messageCount,
      })), {
        onFolderProgress: (_current, _total) => {
          // logger.debug(`同步文件夹进度: ${current}/${total}`)
        },
        onChatProgress: (_current, _total) => {
          // logger.debug(`同步会话进度: ${current}/${total}`)
        },
      })

      // Log results
      if (failedFolders > 0)
        logger.warn(`${failedFolders} 个文件夹同步失败`)
      if (failedChats > 0)
        logger.warn(`${failedChats} 个会话同步失败`)

      logger.log('同步完成')
    }
    catch (error) {
      logger.withError(error).error('同步失败')
      throw error
    }
  }
}

// Register command
export default new SyncCommand()
