/**
 * Chat result from Telegram
 */
export interface TelegramChat {
  id: number
  name: string
  type: 'user' | 'group' | 'channel'
  unreadCount: number
  messageCount?: number
  lastMessage?: string
  lastMessageDate?: Date
}

/**
 * Chats result from Telegram
 */
export interface TelegramChatsResult {
  chats: TelegramChat[]
  total: number
}
