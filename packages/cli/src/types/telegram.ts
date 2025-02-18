/**
 * Telegram folder interface
 */
export interface TelegramFolder {
  id: number
  title: string
  emoji?: string
}

/**
 * Telegram chat interface
 */
export interface TelegramChat {
  id: number
  type: 'user' | 'group' | 'channel' | 'saved'
  title: string
  folderId?: number // 会话所属的文件夹 ID
  lastSyncTime?: Date
  messageCount?: number
}

/**
 * Telegram message interface
 */
export interface TelegramMessage {
  id: number
  chatId: number
  type: 'text' | 'photo' | 'video' | 'document' | 'sticker' | 'other'
  content?: string
  createdAt: Date
  fromId?: number
  replyToId?: number
  forwardFromChatId?: number
  forwardFromMessageId?: number
  views?: number
  forwards?: number
}

/**
 * Telegram adapter interface
 */
export interface TelegramAdapter {
  type: 'client' | 'bot'
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  /**
   * Get chats with folder information
   */
  getChats: () => Promise<TelegramChat[]>
  getFolders: () => Promise<TelegramFolder[]>
  getDialogs: () => Promise<{
    dialogs: Array<{
      id: number
      type: string
      name: string
      unreadCount: number
    }>
  }>
  onMessage: (callback: (message: TelegramMessage) => void) => void
}
