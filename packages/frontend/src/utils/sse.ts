import type { ApiResponse } from '@tg-search/server/types'

// API base URL with fallback
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

/**
 * Create SSE connection with event handlers
 */
export async function createSSEConnection<T>(
  url: string,
  params: Record<string, unknown>,
  handlers: SSEHandlers<T>,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(params),
    signal,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to connect to SSE')
  }

  const eventSource = response.body?.getReader()
  if (!eventSource) {
    throw new Error('Failed to create event source')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await eventSource.read()
      if (done)
        break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim())
          continue

        if (line.startsWith('event: ')) {
          const eventType = line.slice(7).trim()
          const dataLine = lines[lines.indexOf(line) + 1]
          if (!dataLine?.startsWith('data: '))
            continue

          const data = JSON.parse(dataLine.slice(6)) as ApiResponse<T>

          switch (eventType) {
            case 'info':
              handlers.onInfo?.(data.message || 'Unknown info')
              break
            case 'init':
              handlers.onInit?.(data)
              break
            case 'update':
            case 'partial':
              handlers.onUpdate?.(data)
              break
            case 'error':
              handlers.onError?.(new Error(data.message || 'Unknown error'))
              break
            case 'complete':
              handlers.onComplete?.(data)
              break
          }
        }
      }
    }
  }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw error

    handlers.onError?.(error as Error)
  }
  finally {
    eventSource.cancel()
  }
}
