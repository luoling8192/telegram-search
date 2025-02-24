import type { Command } from '@tg-search/server/types'

import { computed, ref } from 'vue'

import { useSSE } from './sse'

export function useCommandHandler() {
  const commands = ref<Command[]>([])
  const error = ref<Error | null>(null)
  const commandsMap = ref<Map<string, Command>>(new Map())

  const {
    loading: isLoading,
    error: sseError,
    isConnected,
    createConnection,
  } = useSSE<Command, Command>()

  const currentCommand = computed(() => {
    for (const cmd of commandsMap.value.values()) {
      if (cmd.status === 'running')
        return cmd
    }
    return commands.value[0] || null
  })

  function updateCommand(command: Command) {
    commandsMap.value.set(command.id, command)
    commands.value = Array.from(commandsMap.value.values())
  }

  function cleanup() {
    error.value = null
    commands.value = []
    commandsMap.value.clear()
  }

  return {
    commands,
    isLoading,
    isStreaming: computed(() => isConnected.value),
    currentCommand,
    error: computed(() => error.value || sseError.value),
    isConnected,
    updateCommand,
    createConnection,
    cleanup,
  }
}
