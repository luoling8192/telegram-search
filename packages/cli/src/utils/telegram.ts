import type { TelegramAdapter } from '@tg-search/core'
import type { Chat } from '@tg-search/db'
import * as input from '@inquirer/prompts'
import { getAllChats } from '@tg-search/db'

export interface SelectedChat extends Chat {}

/**
 * Telegram utilities
 */
export class TelegramUtils {
  /**
   * Search and select a chat from available chats
   */
  static async selectChat(client: TelegramAdapter): Promise<SelectedChat> {
    const chats = await getAllChats()
    if (chats.length === 0)
      throw new Error('No chats available')

    // First ask for search query
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
        name: chat.title,
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
      await client.getMe()
    }
    catch (error) {
      throw new Error('Failed to validate Telegram connection')
    }
  }
} 
