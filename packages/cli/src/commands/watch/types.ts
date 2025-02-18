/**
 * Watch command options
 */
export interface WatchOptions {
  folderId?: number
  chatId?: number
  messageTypes?: string[]
  maxMessages?: number
}

/**
 * Watch progress context
 */
export interface WatchProgressContext {
  onMessageReceived: (message: {
    id: number
    type: string
    content?: string
    createdAt: Date
  }) => void
  onMessageSaved: (count: number) => void
}
