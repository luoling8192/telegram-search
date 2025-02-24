import type { ApiError, ApiResponse } from '@tg-search/server'

import { ofetch } from 'ofetch'
import { ref } from 'vue'

import { useReconnect } from '../apis/useReconnect'
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
  const {
    attempts: reconnectAttempts,
    maxAttempts: maxReconnectAttempts,
    calculateDelay: reconnectDelay,
    resetAttempts,
    recordAttempt,
  } = useReconnect()

  async function createConnection(
    url: string,
    params: Record<string, unknown>,
    handlers: SSEHandlers<T>,
  ) {
    if (abortController.value) {
      abortController.value.abort()
    }
    abortController.value = new AbortController()

    try {
      loading.value = true
      error.value = null

      const response = await ofetch.raw(`${API_BASE}${url}`, {
        method: 'POST',
        body: params,
        signal: abortController.value.signal,
        responseType: 'stream',
        onResponseError: () => {},
      })

      if (!response.ok) {
        throw new Error('Failed to connect to SSE')
      }

      const reader = response._data!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // Create event type to handler mapping
      const eventHandlers: Record<string, (data: ApiResponse<T>) => void> = {
        info: (data) => {
          handlers.onInfo?.(data.message || 'Unknown info')
          isConnected.value = true
          resetAttempts()
        },
        init: data => handlers.onInit?.(data),
        update: data => handlers.onUpdate?.(data),
        partial: data => handlers.onUpdate?.(data),
        complete: (data) => {
          handlers.onComplete?.(data)
          isConnected.value = false
          resetAttempts()
        },
        error: (data) => {
          handlers.onError?.(new Error(data.message || 'Unknown error') as ApiError)
          isConnected.value = false
          recordAttempt()
        },
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
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

              const handler = eventHandlers[eventType]
              if (handler && dataLine?.startsWith('data: ')) {
                const data = JSON.parse(dataLine.slice(6)) as ApiResponse<T>
                handler(data)
              }
            }
          }
        }
      }
      finally {
        reader.cancel()
      }
    }
    catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          isConnected.value = false
          return
        }
        recordAttempt()
      }

      const message = e instanceof Error ? e.message : 'Unknown error'
      error.value = message
      isConnected.value = false
      handlers.onError?.(new Error(message) as ApiError)
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
