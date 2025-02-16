import { pgEnum } from 'drizzle-orm/pg-core'

// Message type enum
export const messageTypeEnum = pgEnum('message_type', [
  'text',
  'photo',
  'video',
  'document',
  'sticker',
  'other',
])
export type MessageType = (typeof messageTypeEnum.enumValues)[number]

// Chat type enum
export const chatTypeEnum = pgEnum('chat_type', [
  'user',
  'group',
  'channel',
  'saved',
])

// Media file info type
export interface MediaInfo {
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
  localPath?: string
}
