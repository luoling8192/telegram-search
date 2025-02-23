import type { DatabaseMessageType } from '@tg-search/db'
import type { ApiResponse, Command, ExportCommand, ExportMethod } from '@tg-search/server/types'

import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useSSE } from '../composables/sse'

interface ExportParams {
  chatId: number
  messageTypes: DatabaseMessageType[]
  method: ExportMethod

  [key: string]: unknown
}

/**
 * Commands composable for managing command state and functionality
 */
export function useCommands() {
  // Command state
  const commands = ref<Command[]>([])
  const error = ref<Error | null>(null)
  const exportProgress = ref<string[]>([])
  const lastExportParams = ref<ExportParams | null>(null)

  // Initialize SSE
  const {
    loading: isLoading,
    error: sseError,
    isConnected,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectDelay,
    createConnection,
  } = useSSE<Command>()

  // Current command state
  const currentCommand = computed<Command | ExportCommand | null>(() => {
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

    error.value = null
    lastExportParams.value = params
    exportProgress.value = []

    // Show loading toast
    const toastId = toast.loading('正在准备导出...')

    try {
      await createConnection('/commands/export', params, {
        onInfo: (info: string) => {
          exportProgress.value.push(info)
          toast.loading(info, { id: toastId })
        },
        onInit: (data: ApiResponse<Command>) => {
          if (!data.success || !data.data)
            return
          const newCommand = Array.isArray(data.data) ? data.data[0] : data.data
          if (newCommand) {
            commands.value = [newCommand]
          }
        },
        onUpdate: (data: ApiResponse<Command>) => {
          if (!data.success || !data.data)
            return
          const command = data.data
          updateCommand(command)

          // Update toast based on command status
          if (command.status === 'success') {
            toast.success('导出完成', { id: toastId })
          }
          else if (command.status === 'error') {
            toast.error(`导出失败: ${command.message}`, { id: toastId })
          }
          else if (command.message) {
            toast.loading(command.message, { id: toastId })
          }
        },
        onError: (err: Error) => {
          error.value = err
          toast.error(`导出失败: ${err.message}`, { id: toastId })

          // Try to reconnect if not exceeded max attempts
          if (reconnectAttempts.value < maxReconnectAttempts) {
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
        onComplete: (_data: ApiResponse<Command>) => {
          // Handle completion
        },
      })

      return true
    }
    catch (err) {
      error.value = err as Error
      toast.error(err instanceof Error ? err.message : '导出失败', { id: toastId })
      return false
    }
  }

  /**
   * Cleanup function
   */
  function cleanup() {
    error.value = null
    lastExportParams.value = null
    exportProgress.value = []
    commands.value = []
  }

  return {
    // State
    commands,
    isLoading,
    isStreaming: computed(() => isConnected.value),
    currentCommand,
    error: computed(() => error.value || sseError.value),
    exportProgress,
    isConnected,

    // Methods
    executeExport,
    cleanup,
  }
}
