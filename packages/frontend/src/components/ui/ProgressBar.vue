<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  progress: number
  status?: 'default' | 'waiting' | 'running' | 'completed' | 'failed'
  showPercentage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  status: 'default',
  showPercentage: true,
})

const statusClasses = computed(() => {
  const classes = {
    default: 'bg-blue-500',
    waiting: 'bg-blue-600 animate-pulse',
    running: 'bg-yellow-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  }

  return classes[props.status]
})
</script>

<template>
  <div>
    <div class="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
      <div
        class="h-3 rounded-full transition-all duration-500 ease-in-out"
        :class="statusClasses"
        :style="{ width: `${progress}%` }"
      />
    </div>
    <div v-if="showPercentage" class="mt-2 flex justify-between text-sm text-gray-600 dark:text-gray-400">
      <span>进度</span>
      <span class="font-medium">{{ progress }}%</span>
    </div>
  </div>
</template>
