import type { Command, ExportParams } from '@tg-search/server/types'
import type { SSEClientOptions } from '../../composables/sse'

import { ref } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

export function useExport() {
  const {
    currentCommand,
    updateCommand,
    createConnection,
    ...commandHandler
  } = useCommandHandler()

  const exportProgress = ref<string[]>([])
  const lastExportParams = ref<ExportParams | null>(null)

  async function executeExport(params: ExportParams) {
    if (currentCommand.value?.status === 'running') {
      return { success: false, error: '已有正在进行的导出任务' }
    }

    lastExportParams.value = params
    exportProgress.value = []

    const options: SSEClientOptions<Command, Command> = {
      onProgress: (data: Command | string) => {
        if (typeof data === 'string') {
          exportProgress.value.push(data)
        }
        else {
          updateCommand(data)
        }
      },
      onComplete: updateCommand,
      onError: (error) => {
        return { success: false, error }
      },
    }

    try {
      await createConnection('/commands/export', params, options)
      return { success: true }
    }
    catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error('导出失败'),
      }
    }
  }

  function cleanup() {
    commandHandler.cleanup()
    exportProgress.value = []
    lastExportParams.value = null
  }

  return {
    ...commandHandler,
    currentCommand,
    exportProgress,
    lastExportParams,
    executeExport,
    cleanup,
  }
}
