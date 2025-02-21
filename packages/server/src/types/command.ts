// Command types
export const commandTypes = ['export', 'import', 'sync', 'watch'] as const
export type CommandType = typeof commandTypes[number]

// Command status
export const commandStatus = ['idle', 'running', 'success', 'error'] as const
export type CommandStatus = typeof commandStatus[number]

// Message type
export const messageTypes = ['text', 'photo', 'video', 'document', 'sticker', 'other'] as const
export type MessageType = typeof messageTypes[number]

// Export method type
export const exportMethods = ['getMessage', 'takeout'] as const
export type ExportMethod = typeof exportMethods[number]

// Command interface
export interface Command {
  id: string
  type: CommandType
  status: CommandStatus
  progress: number
  message: string
  createdAt: Date
  updatedAt: Date
}

// Command handler interface
export interface CommandHandler {
  execute: (params: any) => Promise<void>
  onProgress?: (progress: number, message: string) => void
}

// Command store interface
export interface CommandStore {
  get: (id: string) => Command | undefined
  getAll: () => Command[]
  create: (type: CommandType) => Command
  update: (id: string, updates: Partial<Command>) => void
  delete: (id: string) => void
}

// Command options interface
export interface CommandOptions {
  store: CommandStore
  onProgress?: (command: Command) => void
  onComplete?: (command: Command) => void
  onError?: (command: Command, error: Error) => void
}
