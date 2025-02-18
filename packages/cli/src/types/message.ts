/**
 * Message type
 */
export type MessageType = 'text' | 'photo' | 'video' | 'document' | 'sticker' | 'other'

/**
 * Base message interface
 */
export interface Message {
  id: number
  chatId: number
  type: MessageType
  content: string
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
  forwardFromMessageId?: number
  views?: number
  forwards?: number
  embedding?: number[]
  mediaInfo?: {
    fileId: string
    type: string
    mimeType?: string
    fileName?: string
    fileSize?: number
    width?: number
    height?: number
    duration?: number
    thumbnail?: {
      fileId: string
      width: number
      height: number
    }
  }
}
