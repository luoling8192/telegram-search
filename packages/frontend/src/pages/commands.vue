<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Toaster } from 'vue-sonner'
import { useChats } from '../apis/useChats'
import { useCommandHandler } from '../composables/useCommands'

// API composables
const { chats, error: apiError, loadChats } = useChats()
const { commands, error: commandError, cleanup } = useCommandHandler()

// Active command type
const activeCommandType = ref<'export' | 'import' | 'sync' | 'watch'>('export')

// Command type options
const commandTypeOptions = [
  { label: '导出', value: 'export' as const },
  { label: '导入', value: 'import' as const, disabled: true },
  { label: '同步', value: 'sync' as const, disabled: true },
  { label: '监控', value: 'watch' as const, disabled: true },
]

// Lifecycle hooks
onMounted(() => {
  loadChats()
})

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div class="p-4">
    <!-- Header -->
    <div class="mb-4">
      <h1 class="mb-4 text-2xl font-bold">
        命令管理
      </h1>

      <!-- Command type selection -->
      <div class="mb-4 flex space-x-2">
        <button
          v-for="option in commandTypeOptions"
          :key="option.value"
          class="rounded px-4 py-2 text-sm font-medium"
          :class="{
            'bg-blue-500 text-white': activeCommandType === option.value,
            'bg-gray-100 text-gray-700': activeCommandType !== option.value,
            'opacity-50 cursor-not-allowed': option.disabled,
          }"
          :disabled="option.disabled"
          @click="activeCommandType = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <!-- Command form -->
      <ExportCommand
        v-if="activeCommandType === 'export'"
        :chats="chats"
      />
    </div>

    <!-- Error message -->
    <div
      v-if="apiError || commandError"
      class="mb-4 rounded bg-red-100 p-4 text-red-700"
    >
      {{ apiError || commandError }}
    </div>

    <!-- Command list -->
    <CommandList :commands="commands" />

    <!-- Toast container -->
    <Toaster position="top-right" rich-colors />
  </div>
</template>
