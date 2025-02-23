import type { ApiResponse } from '@tg-search/server'

import { ApiError } from '@tg-search/server'
import { ref } from 'vue'

import { API_BASE } from '../constants'

interface SSEHandlers<T> {
  onInfo: (info: string) => void
  onInit?: (data: ApiResponse<T>) => void
  onUpdate: (data: ApiResponse<T>) => void
  onError: (error: ApiError) => void
  onComplete: (data: ApiResponse<T>) => void
}

/**
 * Create SSE connection with event handlers and state management
 */
export function useSSE<T>() {
  // Connection state
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const abortController = ref<AbortController | null>(null)
  const isConnected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 5000

  async function createConnection(
    url: string,
    params: Record<string, unknown>,
    handlers: SSEHandlers<T>,
  ) {
    // Cancel previous connection if exists
    if (abortController.value) {
      abortController.value.abort()
    }

    // Create new abort controller
    abortController.value = new AbortController()

    try {
      loading.value = true
      error.value = null

      const response = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(params),
        signal: abortController.value.signal,
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
                  isConnected.value = true
                  reconnectAttempts.value = 0
                  break
                case 'init':
                  handlers.onInit?.(data)
                  break
                case 'update':
                case 'partial':
                  handlers.onUpdate?.(data)
                  break
                case 'error':
                  handlers.onError?.(new ApiError(data.message || 'Unknown error'))
                  isConnected.value = false
                  break
                case 'complete':
                  handlers.onComplete?.(data)
                  isConnected.value = false
                  break
              }
            }
          }
        }
      }
      finally {
        eventSource.cancel()
      }
    }
    catch (e) {
      if (e instanceof Error && e.name === 'AbortError')
        throw e

      const message = e instanceof Error ? e.message : 'Unknown error'
      error.value = message
      isConnected.value = false
      handlers.onError?.(new ApiError(message))
    }
    finally {
      loading.value = false
      abortController.value = null
    }
  }

  return {
    loading,
    error,
    isConnected,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectDelay,
    createConnection,
  }
}
