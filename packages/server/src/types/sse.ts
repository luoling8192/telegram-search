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
  complete: (data: unknown) => void
  error: (error: unknown) => void
}

/**
 * SSE event emitter type
 */
export type SSEEventEmitter = Map<string, (data: Uint8Array) => void>
