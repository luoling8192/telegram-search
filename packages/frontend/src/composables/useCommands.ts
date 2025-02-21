import type { Command, ExportParams } from '../types/command'

import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { createSSEConnection } from '../utils/sse'

/**
 * Commands composable for managing command state and functionality
 */
export function useCommands() {
  // Command state
  const commands = ref<Command[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const isConnected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 5000

  // Store last export params for reconnection
  const lastExportParams = ref<ExportParams | null>(null)

  // Stream state
  const streamController = ref<AbortController | null>(null)
  const exportProgress = ref<string[]>([])

  // Current command state
  const currentCommand = computed(() => {
    if (commands.value.length === 0)
      return null
    return commands.value.find(cmd => cmd.status === 'running') || commands.value[0]
  })

  /**
   * Start export command with SSE
   */
  async function executeExport(params: ExportParams) {
    isLoading.value = true
    error.value = null
    lastExportParams.value = params
    exportProgress.value = []

    // Cancel previous stream if exists
    if (streamController.value) {
      streamController.value.abort()
    }

    // Create new stream controller
    streamController.value = new AbortController()

    // Show loading toast
    const toastId = toast.loading('正在准备导出...')

    try {
      // Check if there's already a running export
      if (commands.value.some(cmd => cmd.status === 'running')) {
        throw new Error('已有正在进行的导出任务')
      }

      await createSSEConnection<{ data: Command }>('/commands/export', params, {
        onInfo: (info) => {
          exportProgress.value.push(info)
          isConnected.value = true
          reconnectAttempts.value = 0
          toast.loading(info, { id: toastId })
        },
        onInit: (data) => {
          commands.value = Array.isArray(data.data) ? data.data : [data.data]
        },
        onUpdate: (data) => {
          // The response data contains a single command
          const command = data.data
          if (!command)
            return

          const index = commands.value.findIndex(c => c.id === command.id)
          if (index !== -1) {
            commands.value[index] = command
          }
          else {
            commands.value.unshift(command)
          }

          // Update toast based on command status
          if (command.status === 'success') {
            toast.success('导出完成', { id: toastId })
          }
          else if (command.status === 'error') {
            toast.error(`导出失败: ${command.message}`, { id: toastId })
          }
          else {
            toast.loading(command.message, { id: toastId })
          }
        },
        onError: (err) => {
          error.value = err
          isConnected.value = false
          toast.error(`导出失败: ${err.message}`, { id: toastId })

          // Try to reconnect if not exceeded max attempts
          if (reconnectAttempts.value < maxReconnectAttempts) {
            reconnectAttempts.value++
            const delay = reconnectDelay * reconnectAttempts.value
            toast.error(`命令服务连接失败，${delay / 1000} 秒后重试...`)
            setTimeout(() => executeExport(lastExportParams.value!), delay)
          }
          else {
            toast.error('命令服务连接失败，请刷新页面重试')
          }
        },
        onComplete: () => {
          isConnected.value = false
        },
      }, streamController.value.signal)

      return true
    }
    catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Ignore aborted requests
        toast.dismiss(toastId)
        return false
      }

      error.value = err as Error
      toast.error(err instanceof Error ? err.message : '导出失败', { id: toastId })
      return false
    }
    finally {
      isLoading.value = false
      streamController.value = null
    }
  }

  /**
   * Cleanup function
   */
  function cleanup() {
    if (streamController.value) {
      streamController.value.abort()
      streamController.value = null
    }
    isConnected.value = false
    reconnectAttempts.value = 0
    error.value = null
    lastExportParams.value = null
    exportProgress.value = []
  }

  return {
    // State
    commands,
    currentCommand,
    isLoading,
    error,
    isConnected,
    exportProgress,

    // Methods
    executeExport,
    cleanup,
  }
}
