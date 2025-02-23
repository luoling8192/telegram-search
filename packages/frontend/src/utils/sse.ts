import type { ApiResponse } from '@tg-search/server/utils/response'

// API base URL with fallback
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

/**
 * Parse SSE response data
 */
function parseSSEData<T>(data: string): ApiResponse<T> {
  try {
    // Ensure data is properly trimmed
    const trimmedData = data.trim()
    if (!trimmedData) {
      throw new Error('Empty data')
    }
    return JSON.parse(trimmedData)
  }
  catch (error) {
    console.error('SSE data parsing error:', error, 'Data:', data)
    // If data is a plain string (like info messages), wrap it
    return {
      success: true,
      data: data as T,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * SSE event handlers
 */
export interface SSEHandlers<T> {
  onInfo?: (info: string) => void
  onInit?: (data: T) => void
  onUpdate?: (data: T) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

/**
 * Create SSE connection with event handling
 */
export async function createSSEConnection<T>(
  endpoint: string,
  params: Record<string, any>,
  handlers: SSEHandlers<T>,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
    body: JSON.stringify(params),
    signal,
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          processMessage(buffer)
        }
        break
      }

      // Add new data to buffer
      buffer += decoder.decode(value, { stream: true })

      // Process complete messages
      const messages = buffer.split('\n\n')
      // Keep the last incomplete message
      buffer = messages.pop() || ''

      for (const message of messages) {
        processMessage(message)
      }
    }
  }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Ignore aborted requests
      return
    }
    handlers.onError?.(error instanceof Error ? error : new Error('Failed to process SSE stream'))
  }
  finally {
    try {
      await reader.cancel()
    }
    catch {
      // Ignore reader cancel errors
    }
  }

  function processMessage(message: string) {
    if (!message.trim())
      return

    // Parse event and data
    const lines = message.split('\n')
    const eventLine = lines.find(line => line.startsWith('event:'))
    const dataLine = lines.find(line => line.startsWith('data:'))

    if (!eventLine || !dataLine)
      return

    const eventType = eventLine.slice(6).trim()
    const data = dataLine.slice(5).trim()

    try {
      switch (eventType) {
        case 'info': {
          const response = parseSSEData<string>(data)
          handlers.onInfo?.(response.success ? response.data : response.error)
          break
        }
        case 'init': {
          const response = parseSSEData<T>(data)
          if (response.success) {
            handlers.onInit?.(response.data)
          }
          else {
            handlers.onError?.(new Error(response.error))
          }
          break
        }
        case 'update': {
          const response = parseSSEData<T>(data)
          if (response.success) {
            handlers.onUpdate?.(response.data)
          }
          else {
            handlers.onError?.(new Error(response.error))
          }
          break
        }
        case 'error': {
          const response = parseSSEData<never>(data)
          handlers.onError?.(new Error(response.success ? 'Unknown error' : response.error))
          break
        }
        case 'complete': {
          handlers.onComplete?.()
          break
        }
      }
    }
    catch (error) {
      console.error('Error processing SSE message:', error)
      handlers.onError?.(error instanceof Error ? error : new Error('Failed to process SSE message'))
    }
  }
}
