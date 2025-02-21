import type { Command } from '@tg-search/server/routes/commands'
import type { ApiResponse } from '@tg-search/server/utils/response'

import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { useApi } from './api'

// API base URL with fallback
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

/**
 * Parse SSE response data
 */
function parseSSEData<T>(data: string): ApiResponse<T> {
  try {
    const trimmedData = data.trim()
    if (!trimmedData) {
      throw new Error('Empty data')
    }
    return JSON.parse(trimmedData)
  }
  catch (error) {
    console.error('SSE data parsing error:', error, 'Data:', data)
    return {
      success: true,
      data: data as T,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Commands composable for managing command state and functionality
 */
export function useCommands() {
  const { startExport } = useApi()

  // Command state
  const commands = ref<Command[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const eventSource = ref<EventSource | null>(null)

  /**
   * Connect to SSE for command updates
   */
  function connectSSE() {
    if (eventSource.value) {
      eventSource.value.close()
    }

    eventSource.value = new EventSource(`${API_BASE}/commands/events`)

    // Handle different event types
    eventSource.value.addEventListener('init', (event: MessageEvent) => {
      try {
        const response = parseSSEData<Command[]>(event.data)
        if (response.success) {
          commands.value = response.data
        }
      }
      catch (err) {
        console.error('Failed to parse init event:', err)
      }
    })

    eventSource.value.addEventListener('update', (event: MessageEvent) => {
      try {
        const response = parseSSEData<Command>(event.data)
        if (response.success) {
          const index = commands.value.findIndex(c => c.id === response.data.id)
          if (index !== -1) {
            commands.value[index] = response.data
          }
          else {
            commands.value.unshift(response.data)
          }
        }
      }
      catch (err) {
        console.error('Failed to parse update event:', err)
      }
    })

    eventSource.value.addEventListener('error', (event: MessageEvent) => {
      try {
        const response = parseSSEData<never>(event.data)
        if (!response.success) {
          toast.error(response.error)
        }
      }
      catch (err) {
        console.error('Failed to parse error event:', err)
      }
    })

    eventSource.value.onerror = () => {
      console.error('SSE connection error')
      eventSource.value?.close()
      // Try to reconnect after 5 seconds
      setTimeout(connectSSE, 5000)
    }
  }

  /**
   * Start export command
   */
  async function executeExport(params: {
    chatId: number
    messageTypes: string[]
  }) {
    isLoading.value = true
    error.value = null

    try {
      await startExport(params)
      toast.success('开始导出')
      return true
    }
    catch (err) {
      error.value = err as Error
      toast.error(err instanceof Error ? err.message : '导出失败')
      return false
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Cleanup function
   */
  function cleanup() {
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
    }
  }

  return {
    // State
    commands,
    isLoading,
    error,

    // Methods
    connectSSE,
    executeExport,
    cleanup,
  }
}
