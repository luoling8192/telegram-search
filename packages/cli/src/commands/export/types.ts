import type { Message } from '@tg-search/db'

export interface ExportOptions {
  path?: string
  chatId?: number
  format?: 'json' | 'html'
  includeMedia?: boolean
}

export interface ExportedMessage extends Message {
  chat: {
    id: number
    title: string
  }
  from?: {
    id: number
    name: string
    avatar?: {
      type: 'photo' | 'emoji'
      value: string
      color?: string
    }
  }
  replyTo?: {
    id: number
    content: string
  }
  forwardFrom?: {
    chatId: number
    messageId: number
  }
  media?: {
    type: string
    url: string
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
