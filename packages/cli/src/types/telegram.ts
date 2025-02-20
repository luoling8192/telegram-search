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
  uuid?: string
  lastMessage?: string | null
  lastMessageDate?: Date | null
  lastSyncTime?: Date
  messageCount?: number
  folderId: number | null
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
  fromName?: string
  fromAvatar?: {
    type: 'photo' | 'emoji'
    value: string
    color?: string
  }
  replyToId?: number
  forwardFromChatId?: number
  forwardFromChatName?: string
  forwardFromMessageId?: number
  views?: number
  forwards?: number
  links?: string[]
  mediaInfo?: {
    type: string
    fileName?: string
    fileSize?: number
    width?: number
    height?: number
    duration?: number
    thumbnail?: {
      url: string
      width: number
      height: number
    }
  }
}

/**
 * Options for getting messages
 */
export interface GetMessagesOptions {
  limit?: number
  skipMedia?: boolean
  startTime?: Date
  endTime?: Date
  messageTypes?: Array<'text' | 'photo' | 'video' | 'document' | 'sticker' | 'other'>
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
  /**
   * Get messages from chat
   * @param chatId - Chat ID
   * @param options - Options for getting messages
   */
  getMessages: (chatId: number, options?: GetMessagesOptions) => AsyncGenerator<TelegramMessage>
}
