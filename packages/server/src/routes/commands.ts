import type { Command } from '../types/command'
import type { SSEEventEmitter } from '../utils/sse'

import { useLogger } from '@tg-search/common'
import { Elysia, t } from 'elysia'

import { InMemoryCommandStore } from '../services/command-store'
import { ExportCommandHandler } from '../services/commands/export'
import { createResponse } from '../utils/response'
import { broadcastSSEEvent, createSSEMessage, createSSEResponse } from '../utils/sse'

const logger = useLogger()

/**
 * Manages command execution and event broadcasting
 */
class CommandManager {
  private readonly store: InMemoryCommandStore
  private readonly eventEmitter: SSEEventEmitter

  constructor() {
    this.store = new InMemoryCommandStore()
    this.eventEmitter = new Map()
  }

  /**
   * Create handler options with event callbacks
   */
  private createHandlerOptions() {
    return {
      store: this.store,
      onProgress: (command: Command) => {
        this.broadcastUpdate(command)
      },
      onComplete: (command: Command) => {
        this.broadcastUpdate(command)
      },
      onError: (_command: Command, error: Error) => {
        this.broadcastError(error)
      },
    }
  }

  /**
   * Broadcast command update event
   */
  private broadcastUpdate(command: Command) {
    broadcastSSEEvent(this.eventEmitter, 'update', createResponse(command))
  }

  /**
   * Broadcast error event
   */
  private broadcastError(error: Error) {
    broadcastSSEEvent(this.eventEmitter, 'error', createResponse(undefined, error))
  }

  /**
   * Get all commands
   */
  getAllCommands() {
    return this.store.getAll()
  }

  /**
   * Handle SSE connection
   */
  handleSSE() {
    return createSSEResponse(async (controller) => {
      const initialData = createResponse(this.store.getAll())
      controller.enqueue(createSSEMessage('init', initialData))
    }, this.eventEmitter)
  }

  /**
   * Execute export command
   */
  async executeExport(params: {
    chatId: number
    format?: 'database' | 'html' | 'json'
    messageTypes?: Array<'text' | 'photo' | 'video' | 'document' | 'sticker' | 'other'>
    startTime?: string
    endTime?: string
    limit?: number
    method?: 'getMessage' | 'takeout'
  }) {
    const command = this.store.create('export')
    const handler = new ExportCommandHandler(this.createHandlerOptions())

    try {
      await handler.execute(params)
      return createResponse(this.store.get(command.id))
    }
    catch (error) {
      return createResponse(undefined, error)
    }
  }
}

// Initialize command manager
const commandManager = new CommandManager()

// Command routes
export const commandRoute = new Elysia({ prefix: '/commands' })
  .onError(({ code, error }) => {
    logger.withError(error).error(`Error handling request: ${code}`)
    return createResponse(undefined, error)
  })
  .get('/', () => {
    return createResponse(commandManager.getAllCommands())
  })
  .get('/events', () => {
    return commandManager.handleSSE()
  })
  .post('/export', async ({ body }) => {
    return commandManager.executeExport(body)
  }, {
    body: t.Object({
      chatId: t.Number(),
      format: t.Optional(t.Union([
        t.Literal('database'),
        t.Literal('html'),
        t.Literal('json'),
      ])),
      messageTypes: t.Optional(t.Array(t.Union([
        t.Literal('text'),
        t.Literal('photo'),
        t.Literal('video'),
        t.Literal('document'),
        t.Literal('sticker'),
        t.Literal('other'),
      ]))),
      startTime: t.Optional(t.String()),
      endTime: t.Optional(t.String()),
      limit: t.Optional(t.Number()),
      method: t.Optional(t.Union([
        t.Literal('getMessage'),
        t.Literal('takeout'),
      ])),
    }),
  })

// Export route
export const commandRoutes = commandRoute
