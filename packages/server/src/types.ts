export interface PublicMessage {
  uuid: string
  id: number
  chatId: number
  type: MessageType
  content: string | null
  mediaInfo: MediaInfo | null
  createdAt: Date
  fromId: number | null
  replyToId: number | null
  forwardFromChatId: number | null
  forwardFromMessageId: number | null
  views: number | null
  forwards: number | null
} 
