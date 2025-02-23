/**
 * Chat result from Telegram
 */
export interface TelegramChat {
  id: number
  uuid: string
  title: string
  type: 'user' | 'group' | 'channel'
  unreadCount: number
  messageCount?: number
  lastMessage?: string
  lastMessageDate?: string
  lastSyncTime?: string
  folderId?: number | null
}

/**
 * Chats result from Telegram
 */
export interface TelegramChatsResult {
  chats: TelegramChat[]
  total: number
}
