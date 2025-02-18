import type { TelegramAdapter, TelegramChat } from '../types/telegram'

import * as input from '@inquirer/prompts'
import { getAllChats, getAllFolders } from '@tg-search/db'

export interface SelectedChat extends TelegramChat {}

/**
 * Group chats by type and folder
 */
function groupChats(chats: TelegramChat[]) {
  // First group by type
  const byType = new Map<string, TelegramChat[]>()
  for (const chat of chats) {
    const type = chat.type
    if (!byType.has(type))
      byType.set(type, [])
    byType.get(type)!.push(chat)
  }

  return {
    users: byType.get('user') || [],
    groups: byType.get('group') || [],
    channels: byType.get('channel') || [],
    saved: byType.get('saved') || [],
  }
}

/**
 * Format chat name with message count
 */
function formatChatName(chat: TelegramChat) {
  return `${chat.title}${chat.messageCount ? ` (${chat.messageCount} 条消息)` : ''}`
}

/**
 * Telegram utilities
 */
export class TelegramUtils {
  /**
   * Search and select a chat from available chats
   */
  static async selectChat(client: TelegramAdapter): Promise<SelectedChat> {
    const [chats, folders] = await Promise.all([
      getAllChats(),
      getAllFolders(),
    ])

    if (chats.length === 0) {
      // Get chats from Telegram if database is empty
      const telegramChats = await client.getChats()
      if (telegramChats.length === 0)
        throw new Error('未找到任何会话')
      return telegramChats[0]
    }

    // Ask user to choose selection method
    const method = await input.select({
      message: '请选择会话选择方式：',
      choices: [
        { name: '按类型选择', value: 'type' },
        { name: '按文件夹选择', value: 'folder' },
        { name: '搜索会话', value: 'search' },
      ],
    })

    if (method === 'type') {
      // Group chats by type
      const { users, groups, channels, saved } = groupChats(chats)

      // Show grouped chats for selection
      const chatId = await input.select({
        message: '请选择会话：',
        choices: [
          // Users
          { name: '👤 用户', value: -1, disabled: true },
          ...users.map(chat => ({
            name: `  ${formatChatName(chat)}`,
            value: chat.id,
          })),
          // Groups
          { name: '👥 群组', value: -2, disabled: true },
          ...groups.map(chat => ({
            name: `  ${formatChatName(chat)}`,
            value: chat.id,
          })),
          // Channels
          { name: '📢 频道', value: -3, disabled: true },
          ...channels.map(chat => ({
            name: `  ${formatChatName(chat)}`,
            value: chat.id,
          })),
          // Saved
          ...(saved.length > 0
            ? [
                { name: '📌 收藏夹', value: -4, disabled: true },
                ...saved.map(chat => ({
                  name: `  ${formatChatName(chat)}`,
                  value: chat.id,
                })),
              ]
            : []),
        ],
      })

      const chat = chats.find(c => c.id === chatId)
      if (!chat)
        throw new Error('会话未找到')
      return chat
    }

    if (method === 'folder') {
      // First select folder
      const folderId = await input.select({
        message: '请选择文件夹：',
        choices: folders.map(folder => ({
          name: `${folder.emoji || ''} ${folder.title}`,
          value: folder.id,
        })),
      })

      // Then select chat from folder
      const folderChats = chats.filter(chat => chat.folderId === folderId)
      if (folderChats.length === 0)
        throw new Error('文件夹中没有会话')

      const chatId = await input.select({
        message: '请选择会话：',
        choices: folderChats.map(chat => ({
          name: `[${chat.type}] ${formatChatName(chat)}`,
          value: chat.id,
        })),
      })

      const chat = folderChats.find(c => c.id === chatId)
      if (!chat)
        throw new Error('会话未找到')
      return chat
    }

    // Search mode
    const searchQuery = await input.input({
      message: '请输入会话名称关键词：',
    })

    // Filter chats by search query
    const filteredChats = chats.filter(chat =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    if (filteredChats.length === 0) {
      throw new Error('未找到匹配的会话')
    }

    // If only one chat found, ask for confirmation
    if (filteredChats.length === 1) {
      const confirmed = await input.confirm({
        message: `找到会话"${filteredChats[0].title}"，是否使用？`,
        default: true,
      })
      if (!confirmed)
        throw new Error('用户取消选择')
      return filteredChats[0]
    }

    // If multiple chats found, let user select
    const chatId = await input.select({
      message: `找到 ${filteredChats.length} 个会话，请选择：`,
      choices: filteredChats.map(chat => ({
        name: `[${chat.type}] ${formatChatName(chat)}`,
        value: chat.id,
      })),
    })

    const chat = filteredChats.find(c => c.id === chatId)
    if (!chat)
      throw new Error('会话未找到')

    return chat
  }

  /**
   * Validate Telegram connection
   */
  static async validateConnection(client: TelegramAdapter): Promise<void> {
    try {
      // Just try to get chats to validate connection
      await client.getChats()
    }
    catch (error) {
      throw new Error('Failed to validate Telegram connection')
    }
  }
}
