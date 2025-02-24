import type { SSEController } from '../types/sse'

import { SSE_HEADERS } from '../types/sse'
import { createResponse } from './response'

/**
 * SSE message creator
 */
export function createSSEMessage(event: string, data: unknown) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/**
 * Create SSE response with error handling
 */
export function createSSEResponse(
  handler: (controller: SSEController) => Promise<void> | void,
) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        // Create SSE controller with helper methods
        const sseController: SSEController = {
          enqueue: data => controller.enqueue(data),
          close: () => {
            controller.close()
          },
          complete: (data: unknown) => {
            controller.enqueue(createSSEMessage('complete', createResponse(data)))
            controller.close()
          },
          error: (err: unknown) => {
            controller.enqueue(createSSEMessage('error', createResponse(undefined, err)))
            controller.close()
          },
        }

        try {
          // Execute handler without auto-closing
          await handler(sseController)
        }
        catch (err) {
          // Only handle error if controller is still writable
          if (controller.desiredSize !== null) {
            sseController.error(err)
          }
        }
      },
    }),
    { headers: SSE_HEADERS },
  )
}
