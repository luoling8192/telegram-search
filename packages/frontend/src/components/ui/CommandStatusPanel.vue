<!-- Command Status Panel component -->
<script setup lang="ts">
import { computed } from 'vue'
import ProgressBar from './ProgressBar.vue'
import StatusBadge from './StatusBadge.vue'

/**
 * Component for displaying command execution status and progress
 */
type CommandStatus = 'waiting' | 'running' | 'completed' | 'failed'

const props = defineProps<{
  /**
   * Current status of the command
   */
  status: CommandStatus
  /**
   * The title of the command panel
   */
  title?: string
  /**
   * Progress percentage of the command execution (0-100)
   */
  progress: number
  /**
   * Current command message
   */
  message?: string
  /**
   * Error information if command failed
   */
  error?: string | Record<string, any>
  /**
   * Whether to show the completion message
   */
  showCompletionMessage?: boolean
  /**
   * Custom completion message
   */
  completionMessage?: string
}>()

/**
 * Human-readable status text
 */
const statusText = computed((): string => {
  const statusMap: Record<CommandStatus, string> = {
    running: '运行中',
    waiting: '等待中',
    completed: '已完成',
    failed: '失败',
  }
  return statusMap[props.status] || '准备中'
})

/**
 * Status icon
 */
const statusIcon = computed((): string => {
  const iconMap: Record<CommandStatus, string> = {
    running: '⟳',
    waiting: '⏱',
    completed: '✓',
    failed: '✗',
  }
  return iconMap[props.status] || '↻'
})
</script>

<template>
  <div class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100">
    <div class="p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="flex items-center text-lg font-semibold">
          <span class="mr-2">{{ title || '命令状态' }}</span>
          <span
            v-if="status === 'running'"
            class="inline-block animate-spin text-yellow-500"
          >⟳</span>
        </h2>
        <StatusBadge
          :status="status"
          :label="statusText"
          :icon="statusIcon"
        />
      </div>

      <!-- Progress bar -->
      <div class="mb-5">
        <ProgressBar
          :progress="progress"
          :status="status"
        />
      </div>

      <!-- Status message -->
      <div v-if="message" class="mb-4 text-sm text-gray-700 dark:text-gray-300">
        <p class="mb-1 font-medium">
          当前状态:
        </p>
        <p>{{ message }}</p>
      </div>

      <!-- Error information -->
      <div
        v-if="error && status === 'failed'"
        class="animate-fadeIn mt-4 rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/50 dark:text-red-100"
      >
        <p class="mb-2 font-medium">
          错误信息:
        </p>
        <div v-if="typeof error === 'string'" class="text-sm">
          {{ error }}
        </div>
        <div v-else class="text-sm">
          <div>{{ error.name }}: {{ error.message }}</div>
          <pre v-if="error.stack" class="mt-3 overflow-auto rounded-md bg-red-100 p-2 text-xs dark:bg-red-900/50">{{ error.stack }}</pre>
        </div>
      </div>

      <!-- Completion message -->
      <div
        v-if="status === 'completed' && showCompletionMessage"
        class="animate-fadeIn mt-5 rounded-md bg-green-50 p-3 text-green-700 dark:bg-green-900/50 dark:text-green-100"
      >
        <p class="flex items-center">
          <span class="mr-2 text-lg">✓</span>
          <span>{{ completionMessage || '命令已成功完成！' }}</span>
        </p>
      </div>

      <!-- Additional content slot -->
      <slot />
    </div>
  </div>
</template>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.5s ease-in-out;
}

.animate-spin {
  animation: spin 1.5s linear infinite;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
