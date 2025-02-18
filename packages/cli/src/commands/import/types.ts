import type { MessageType } from '@tg-search/db'

export interface ImportOptions {
  path?: string
  noEmbedding?: boolean
}

export interface MessageData {
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
  links?: string[]
  replyToId?: number
  forwardFromChatId?: number
  forwardFromMessageId?: number
  views?: number
  forwards?: number
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

export interface TelegramChat {
  id: number
  type: string
  title: string
} 
