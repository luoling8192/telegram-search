import type { DatabaseMessageType } from '@tg-search/db'
import type { Command, ExportMethod } from '@tg-search/server/types'
import type { SSEClientOptions } from '../composables/sse'

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
    createConnection,
    handleError,
  } = useSSE<Command, Command>()

  // Use Map to store commands
  const commandsMap = ref<Map<string, Command>>(new Map())

  // Current command state
  const currentCommand = computed(() => {
    for (const cmd of commandsMap.value.values()) {
      if (cmd.status === 'running')
        return cmd
    }
    return commands.value[0] || null
  })

  /**
   * Update command in state
   */
  function updateCommand(command: Command) {
    commandsMap.value.set(command.id, command)
    commands.value = Array.from(commandsMap.value.values())
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

    const options: SSEClientOptions<Command, Command> = {
      onProgress: (data: Command | string) => {
        if (typeof data === 'string') {
          exportProgress.value.push(data)
        }
        else {
          updateCommand(data)
        }
      },
      onComplete: (data: Command) => {
        updateCommand(data)
      },
      onError: (error: Error) => {
        handleError(error)
      },
    }

    try {
      await createConnection('/commands/export', params, options)

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
    commandsMap.value.clear()
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
