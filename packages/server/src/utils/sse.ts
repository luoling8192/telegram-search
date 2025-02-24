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
        const sseController: SSEController = {
          enqueue: data => controller.enqueue(data),
          close: () => {
            if (controller.desiredSize !== null) {
              controller.close()
            }
          },
          complete: (data) => {
            if (controller.desiredSize !== null) {
              controller.enqueue(createSSEMessage('complete', createResponse(data)))
              controller.close()
            }
          },
          error: (err) => {
            if (controller.desiredSize !== null) {
              controller.enqueue(createSSEMessage('error', createResponse(undefined, err)))
              controller.close()
            }
          },
          progress: (data) => {
            if (controller.desiredSize !== null) {
              controller.enqueue(createSSEMessage('progress', createResponse(data)))
            }
          },
        }

        try {
          await handler(sseController)
          // 确保处理完成后关闭
          sseController.complete(null)
        }
        catch (err) {
          sseController.error(err)
        }
      },
    }),
    { headers: SSE_HEADERS },
  )
}
