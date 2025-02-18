/**
 * Sync command options
 */
export interface SyncOptions {
  skipFolders?: boolean
  skipChats?: boolean
  clearExisting?: boolean
  clear?: boolean
}

/**
 * Sync progress context
 */
export interface SyncProgressContext {
  onFolderProgress: (current: number, total: number) => void
  onChatProgress: (current: number, total: number) => void
}
