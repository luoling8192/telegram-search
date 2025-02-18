import type { Message } from '../../types/message'

export interface ExportOptions {
  /**
   * Output directory path
   */
  path?: string

  /**
   * Chat ID to export
   */
  chatId?: number

  /**
   * Export format
   */
  format?: 'json' | 'html' | 'db'

  /**
   * Include media files in export
   */
  includeMedia?: boolean
}

export interface ExportedMessage extends Omit<Message, 'fromAvatar'> {
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
