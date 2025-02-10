import { z } from 'zod'

// Message types
export const MessageTypeEnum = z.enum(['text', 'photo', 'video', 'document', 'sticker', 'other'])
export type MessageType = z.infer<typeof MessageTypeEnum>

// Chat types
export const ChatTypeEnum = z.enum(['user', 'group', 'channel', 'saved'])
export type ChatType = z.infer<typeof ChatTypeEnum>

// Message schema
export const MessageSchema = z.object({
  id: z.number(),
  chatId: z.number(),
  type: MessageTypeEnum,
  content: z.string().nullable(),
  mediaInfo: z.object({
    type: z.string(),
    mimeType: z.string().optional(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    duration: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    localPath: z.string().optional(),
  }).nullable(),
  fromId: z.number().nullable(),
  replyToId: z.number().nullable(),
  forwardFromChatId: z.number().nullable(),
  forwardFromMessageId: z.number().nullable(),
  views: z.number().nullable(),
  forwards: z.number().nullable(),
  createdAt: z.date(),
})

// Chat schema
export const ChatSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: ChatTypeEnum,
  lastMessage: z.string().nullable(),
  lastMessageDate: z.date().nullable(),
  lastSyncTime: z.date(),
  messageCount: z.number(),
  folderId: z.number().nullable(),
})

// Folder schema
export const FolderSchema = z.object({
  id: z.number(),
  title: z.string(),
  emoji: z.string().nullable(),
  lastSyncTime: z.date(),
})

// Search options schema
export const SearchOptionsSchema = z.object({
  query: z.string(),
  chatId: z.number().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  messageTypes: z.array(MessageTypeEnum).optional(),
})

// Export types
export type Message = z.infer<typeof MessageSchema>
export type Chat = z.infer<typeof ChatSchema>
export type Folder = z.infer<typeof FolderSchema>
export type SearchOptions = z.infer<typeof SearchOptionsSchema> 
