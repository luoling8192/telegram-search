import type { ApiResponse } from './response'

import { useLogger } from '@tg-search/common'

import { createResponse } from './response'

const logger = useLogger()

/**
 * SSE message creator
 */
export function createSSEMessage(event: string, data: unknown) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/**
 * SSE response headers
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

/**
 * SSE stream controller type
 */
export interface SSEController {
  enqueue: (data: Uint8Array) => void
  close: () => void
}

/**
 * SSE event emitter type
 */
export type SSEEventEmitter = Map<string, (data: Uint8Array) => void>

/**
 * Create SSE response with error handling
 */
export function createSSEResponse(
  handler: (controller: SSEController, clientId: string, emitter: SSEEventEmitter) => Promise<void> | void,
  emitter: SSEEventEmitter = new Map(),
) {
  return new Response(
    new ReadableStream({
      start(controller) {
        try {
          // Generate unique client ID
          const clientId = Math.random().toString(36).substring(7)

          // Create controller wrapper
          const sseController: SSEController = {
            enqueue: data => controller.enqueue(data),
            close: () => controller.close(),
          }

          // Store event emitter
          emitter.set(clientId, (data: Uint8Array) => {
            try {
              controller.enqueue(data)
            }
            catch (err) {
              logger.withError(err).error('Failed to send SSE event')
              // Send error event to client
              const errorData = createResponse(undefined, err)
              controller.enqueue(createSSEMessage('error', errorData))
            }
          })

          // Execute handler
          Promise.resolve(handler(sseController, clientId, emitter))
            .catch((err) => {
              logger.withError(err).error('SSE handler error')
              // Send error event to client
              const errorData = createResponse(undefined, err)
              controller.enqueue(createSSEMessage('error', errorData))
              controller.close()
            })

          // Cleanup on close
          return () => {
            logger.debug(`SSE client ${clientId} disconnected`)
            emitter.delete(clientId)
          }
        }
        catch (err) {
          logger.withError(err).error('Failed to initialize SSE connection')
          // Send error event to client
          const errorData = createResponse(undefined, err)
          controller.enqueue(createSSEMessage('error', errorData))
          controller.close()
        }
      },
    }),
    { headers: SSE_HEADERS },
  )
}

/**
 * Broadcast SSE event to all connected clients
 */
export function broadcastSSEEvent(emitter: SSEEventEmitter, event: string, data: ApiResponse<any>) {
  const message = createSSEMessage(event, data)
  for (const send of emitter.values()) {
    send(message)
  }
}
