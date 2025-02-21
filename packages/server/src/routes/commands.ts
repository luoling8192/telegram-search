import type { ApiResponse } from '../utils/response'

import { getConfig, useLogger } from '@tg-search/common'
import { ExportService } from '@tg-search/core'
import { Elysia, t } from 'elysia'

import { getTelegramClient } from '../services/telegram'
import { createResponse } from '../utils/response'

const logger = useLogger()

// Command types
export const commandTypes = ['export', 'import', 'sync', 'watch'] as const
export type CommandType = typeof commandTypes[number]

// Command status
export const commandStatus = ['idle', 'running', 'success', 'error'] as const
export type CommandStatus = typeof commandStatus[number]

// Message type
export const messageTypes = ['text', 'photo', 'video', 'document', 'sticker', 'other'] as const
export type MessageType = typeof messageTypes[number]

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

// In-memory command store
const commands = new Map<string, Command>()

// Command event emitter
const eventEmitter = new Map<string, (data: string) => void>()

/**
 * Send SSE event to all connected clients
 */
function broadcastEvent(event: string, data: ApiResponse<any>) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const send of eventEmitter.values()) {
    send(message)
  }
}

// Command routes
export const commandRoute = new Elysia({ prefix: '/commands' })
  .onError(({ code, error }) => {
    logger.withError(error).error(`Error handling request: ${code}`)
    return createResponse(undefined, error)
  })
  .get('/', () => {
    return createResponse(Array.from(commands.values()))
  })
  .get('/events', () => {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }

    // Create a new ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Generate unique client ID
        const clientId = Math.random().toString(36).substring(7)

        // Send initial commands
        const initialData = createResponse(Array.from(commands.values()))
        controller.enqueue(`event: init\ndata: ${JSON.stringify(initialData)}\n\n`)

        // Store event emitter
        eventEmitter.set(clientId, (data: string) => {
          controller.enqueue(data)
        })

        // Cleanup on close
        return () => {
          eventEmitter.delete(clientId)
        }
      },
    })

    return new Response(stream, { headers })
  })
  .post('/export', async ({ body }) => {
    const config = getConfig()
    const client = await getTelegramClient()
    const exportService = new ExportService(client)

    // Create command record
    const id = Math.random().toString(36).substring(7)
    const record: Command = {
      id,
      type: 'export',
      status: 'running',
      progress: 0,
      message: 'Starting export...',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    commands.set(id, record)

    // Broadcast command creation
    broadcastEvent('update', createResponse(record))

    // Execute command
    try {
      await exportService.exportMessages({
        chatId: body.chatId,
        format: body.format,
        messageTypes: body.messageTypes,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        limit: body.limit,
        batchSize: config.message.export.batchSize,
        onProgress: (progress: number, message: string) => {
          record.progress = progress
          record.message = message
          record.updatedAt = new Date()
          commands.set(id, record)

          // Broadcast progress update
          broadcastEvent('update', createResponse(record))
        },
      })

      // Update command status
      record.status = 'success'
      record.progress = 100
      record.message = 'Export completed'
      record.updatedAt = new Date()
      commands.set(id, record)

      // Broadcast completion
      broadcastEvent('update', createResponse(record))

      return createResponse(record)
    }
    catch (error) {
      // Update command status
      record.status = 'error'
      record.message = error instanceof Error ? error.message : 'Unknown error'
      record.updatedAt = new Date()
      commands.set(id, record)

      // Broadcast error
      broadcastEvent('error', createResponse(undefined, error))

      return createResponse(undefined, error)
    }
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
    }),
  })

// Export route
export const commandRoutes = commandRoute
