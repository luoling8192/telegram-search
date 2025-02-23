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
    if (!commands.value || commands.value.length === 0) {
      return null
    }
    // Find running command or return the first one
    const runningCommand = commands.value.find(cmd => cmd?.status === 'running')
    return runningCommand || commands.value[0]
  })

  /**
   * Update command in state
   */
  function updateCommand(command: Command) {
    if (!command)
      return

    const index = commands.value.findIndex(c => c?.id === command.id)
    if (index !== -1) {
      commands.value[index] = command
    }
    else {
      commands.value = [command, ...commands.value]
    }
  }

  /**
   * Start export command with SSE
   */
  async function executeExport(params: ExportParams) {
    // Prevent multiple running exports
    if (currentCommand.value?.status === 'running') {
      toast.error('已有正在进行的导出任务')
      return false
    }

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
      await createSSEConnection<{ data: Command }>('/commands/export', params, {
        onInfo: (info) => {
          exportProgress.value.push(info)
          isConnected.value = true
          reconnectAttempts.value = 0
          toast.loading(info, { id: toastId })
        },
        onInit: (data) => {
          const newCommand = Array.isArray(data.data) ? data.data[0] : data.data
          if (newCommand) {
            commands.value = [newCommand]
          }
        },
        onUpdate: (data) => {
          const command = data.data
          if (!command)
            return

          updateCommand(command)

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
            setTimeout(() => {
              if (lastExportParams.value) {
                executeExport(lastExportParams.value)
              }
            }, delay)
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
    commands.value = []
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
