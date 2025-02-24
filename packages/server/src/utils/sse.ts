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
        try {
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

          await handler(sseController)
          controller.close()
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
