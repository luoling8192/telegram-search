/**
 * Chat result from Telegram
 */
export interface Chat {
  id: number
  name: string
  type: 'user' | 'group' | 'channel'
  unreadCount: number
}

/**
 * Chats result from Telegram
 */
export interface ChatsResult {
  chats: Chat[]
  total: number
}
