import type { ExportOptions, ITelegramClientAdapter } from '@tg-search/core'
import type { App, H3Event } from 'h3'
import type { Command } from '../types/apis/command'
import type { SSEController } from '../types/sse'

import { useLogger } from '@tg-search/common'
import { createRouter, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'

import { InMemoryCommandStore } from '../services/command-store'
import { ExportCommandHandler } from '../services/commands/export'
import { useTelegramClient } from '../services/telegram'
import { createResponse } from '../utils/response'
import { createSSEMessage, createSSEResponse } from '../utils/sse'

const logger = useLogger()

// Command validation schema
const exportCommandSchema = z.object({
  chatId: z.number(),
  format: z.enum(['database', 'html', 'json']).optional(),
  messageTypes: z.array(z.enum(['text', 'photo', 'video', 'document', 'sticker', 'other'])).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  limit: z.number().optional(),
  method: z.enum(['getMessage', 'takeout']).optional(),
})

/**
 * Manages command execution and event broadcasting
 */
class CommandManager {
  private readonly store: InMemoryCommandStore

  constructor() {
    this.store = new InMemoryCommandStore()
  }

  /**
   * Create handler options with event callbacks
   */
  private createHandlerOptions(controller: SSEController) {
    return {
      store: this.store,
      onProgress: (command: Command) => {
        const response = createResponse(command)
        controller.enqueue(createSSEMessage('update', response))
      },
      onComplete: (command: Command) => {
        const response = createResponse(command)
        controller.enqueue(createSSEMessage('update', response))
        controller.enqueue(createSSEMessage('complete', createResponse(null)))
        controller.close()
      },
      onError: (_command: Command, error: Error) => {
        const response = createResponse(undefined, error)
        controller.enqueue(createSSEMessage('error', response))
        controller.close()
      },
    }
  }

  /**
   * Get all commands
   */
  getAllCommands(): Command[] {
    return this.store.getAll()
  }

  /**
   * Execute export command with SSE
   */
  executeExportWithSSE(client: ITelegramClientAdapter, params: ExportOptions) {
    return createSSEResponse(async (controller) => {
      const handler = new ExportCommandHandler(this.createHandlerOptions(controller))
      await handler.execute(client, params as unknown as Record<string, unknown>)
    })
  }
}

// Initialize command manager
const commandManager = new CommandManager()

/**
 * Setup command routes
 */
export function setupCommandRoutes(app: App) {
  const router = createRouter()

  // Get all commands
  router.get('/', defineEventHandler(() => {
    return createResponse(commandManager.getAllCommands())
  }))

  // Export command
  router.post('/export', defineEventHandler(async (event: H3Event) => {
    const body = await readBody(event)
    const validatedBody = exportCommandSchema.parse(body)

    logger.withFields(validatedBody).debug('Export request received')

    const client = await useTelegramClient()
    if (!await client.isConnected()) {
      await client.connect()
    }

    // Get chat metadata
    const chats = await client.getChats()
    const chat = chats.find(c => c.id === validatedBody.chatId)
    if (!chat) {
      throw new Error(`Chat ${validatedBody.chatId} not found`)
    }

    // Parse params
    const params = {
      ...validatedBody,
      startTime: validatedBody.startTime ? new Date(validatedBody.startTime) : undefined,
      endTime: validatedBody.endTime ? new Date(validatedBody.endTime) : undefined,
      chatMetadata: {
        id: chat.id,
        title: chat.title,
        type: chat.type,
      },
    }

    // Execute export with SSE
    return commandManager.executeExportWithSSE(client, params)
  }))

  // Mount routes
  app.use('/commands', router.handler)
}
