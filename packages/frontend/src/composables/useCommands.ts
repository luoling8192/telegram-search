import type { Command } from '@tg-search/server/types/command'
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
    // Handle undefined or null data
    if (!data) {
      throw new Error('No data received')
    }
    const trimmedData = data.trim()
    if (!trimmedData) {
      throw new Error('Empty data')
    }
    return JSON.parse(trimmedData)
  }
  catch (error) {
    console.error('SSE data parsing error:', error, 'Data:', data)
    // Return a proper error response instead of trying to handle invalid data
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse SSE data',
      code: error instanceof Error ? error.name : 'PARSE_ERROR',
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
        else {
          console.error('Failed to initialize commands:', response.error)
          toast.error('初始化命令列表失败')
        }
      }
      catch (err) {
        console.error('Failed to parse init event:', err)
        toast.error('初始化命令列表失败')
      }
    })

    eventSource.value.addEventListener('update', (event: MessageEvent) => {
      try {
        const response = parseSSEData<Command>(event.data)
        if (response.success) {
          const index = commands.value.findIndex((c: Command) => c.id === response.data.id)
          if (index !== -1) {
            commands.value[index] = response.data
          }
          else {
            commands.value.unshift(response.data)
          }
        }
        else {
          console.error('Failed to update command:', response.error)
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
          toast.error(response.error || '命令执行失败')
        }
      }
      catch (err) {
        console.error('Failed to parse error event:', err)
        toast.error('命令执行失败')
      }
    })

    eventSource.value.onerror = (event) => {
      console.error('SSE connection error', event)
      eventSource.value?.close()
      error.value = new Error('命令服务连接失败')
      toast.error('命令服务连接失败，正在重试...')
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
    format?: 'database' | 'html' | 'json'
    startTime?: string
    endTime?: string
    limit?: number
    method?: 'getMessage' | 'takeout'
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
