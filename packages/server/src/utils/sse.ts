import { createResponse } from './response'

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
  handler: (controller: SSEController) => Promise<void> | void,
) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          const sseController: SSEController = {
            enqueue: data => controller.enqueue(data),
            close: () => controller.close(),
          }

          await handler(sseController)
        }
        catch (err) {
          const errorData = createResponse(undefined, err)
          controller.enqueue(createSSEMessage('error', errorData))
          controller.close()
        }
      },
    }),
    { headers: SSE_HEADERS },
  )
}
