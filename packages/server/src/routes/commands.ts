import type { ExportOptions } from '@tg-search/core'
import type { Command } from '../types/command'
import type { SSEController, SSEEventEmitter } from '../utils/sse'

import { useLogger } from '@tg-search/common'
import { Elysia, t } from 'elysia'

import { InMemoryCommandStore } from '../services/command-store'
import { ExportCommandHandler } from '../services/commands/export'
import { createResponse } from '../utils/response'
import { createSSEMessage, createSSEResponse } from '../utils/sse'

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
  private createHandlerOptions(controller: SSEController) {
    return {
      store: this.store,
      onProgress: (command: Command) => {
        // Send progress update
        const response = createResponse(command)
        controller.enqueue(createSSEMessage('update', response))
      },
      onComplete: (command: Command) => {
        // Send completion update
        const response = createResponse(command)
        controller.enqueue(createSSEMessage('update', response))
        controller.enqueue(createSSEMessage('info', 'Export completed'))
        controller.enqueue(createSSEMessage('complete', createResponse(null)))
        controller.close()
      },
      onError: (_command: Command, error: Error) => {
        // Send error update
        const response = createResponse(undefined, error)
        controller.enqueue(createSSEMessage('error', response))
        controller.enqueue(createSSEMessage('info', 'Export failed'))
        controller.enqueue(createSSEMessage('complete', createResponse(null)))
        controller.close()
      },
    }
  }

  /**
   * Get all commands
   */
  getAllCommands() {
    return this.store.getAll()
  }

  /**
   * Execute export command with SSE
   */
  async executeExportWithSSE(params: Omit<ExportOptions, 'chatMetadata'>) {
    return createSSEResponse(async (controller) => {
      const startTime = Date.now()

      // Send initial info
      controller.enqueue(createSSEMessage('info', 'Starting export...'))

      // Create export command
      const command = this.store.create('export')

      // Send initial data with the new command
      const initialData = createResponse([command])
      controller.enqueue(createSSEMessage('init', initialData))

      // Execute export command
      const handler = new ExportCommandHandler(this.createHandlerOptions(controller))

      try {
        await handler.execute(params)

        // Log completion
        const duration = Date.now() - startTime
        logger.withFields({
          duration: `${duration}ms`,
        }).debug('Export completed')
      }
      catch (error) {
        // Log error
        logger.withError(error as Error).error('Export failed')
      }
    })
  }
}

// Initialize command manager
const commandManager = new CommandManager()

/**
 * Command routes
 */
export const commandRoute = new Elysia({ prefix: '/commands' })
  .onError(({ code, error }) => {
    logger.withError(error).error(`Error handling request: ${code}`)
    return createResponse(undefined, error)
  })
  .get('/', () => {
    return createResponse(commandManager.getAllCommands())
  })
  .post('/export', async ({ body }) => {
    logger.withFields(body).debug('Export request received')

    // Parse params
    const params = {
      ...body,
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      endTime: body.endTime ? new Date(body.endTime) : undefined,
    }

    // Execute export with SSE
    return commandManager.executeExportWithSSE(params)
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
