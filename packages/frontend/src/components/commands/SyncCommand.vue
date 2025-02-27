<script setup lang="ts">
import type { SyncDetails } from '../../../../server/src/types/apis/sync'
import { computed, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { useSync } from '../../apis/commands/useSync'

// State management
const { executeSync, currentCommand, syncProgress, cleanup } = useSync()
const isSyncing = computed(() => currentCommand.value?.status === 'running')
const canStartSync = computed(() => !currentCommand.value
  || ['completed', 'failed'].includes(currentCommand.value.status))

// Cleanup when component is unmounted
onUnmounted(() => {
  cleanup()
})

// Parse sync details from metadata
const syncDetails = computed((): SyncDetails | null => {
  if (!currentCommand.value?.metadata) {
    return null
  }

  const metadata = currentCommand.value.metadata
  return {
    totalChats: metadata.totalChats as number | undefined,
    totalFolders: metadata.totalFolders as number | undefined,
    processedChats: metadata.processedChats as number | undefined,
    processedFolders: metadata.processedFolders as number | undefined,
  }
})

// Human-readable sync status
const syncStatus = computed((): string => {
  if (!currentCommand.value) {
    return ''
  }

  const statusMap: Record<string, string> = {
    running: '同步中',
    waiting: '等待中',
    completed: '同步完成',
    failed: '同步失败',
    default: '准备同步',
  }

  return statusMap[currentCommand.value.status] || statusMap.default
})

// Status icon based on current state
const statusIcon = computed((): string => {
  if (!currentCommand.value)
    return ''

  const iconMap: Record<string, string> = {
    running: '⟳',
    waiting: '⏱',
    completed: '✓',
    failed: '✗',
    default: '↻',
  }

  return iconMap[currentCommand.value.status] || iconMap.default
})

// Format numbers with commas
function formatNumber(num: number | undefined): string {
  if (num === undefined)
    return '0'
  return num.toLocaleString()
}

// Start sync command
async function handleSync(): Promise<void> {
  const toastId = toast.loading('正在准备同步...')

  try {
    const result = await executeSync({})
    if (result.success) {
      toast.success('同步启动成功', { id: toastId })
    }
    else {
      toast.error(result.error || '同步失败', { id: toastId })
    }
  }
  catch (error) {
    toast.error(`同步错误: ${error instanceof Error ? error.message : '未知错误'}`, { id: toastId })
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Sync Control Panel -->
    <div class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100">
      <div class="p-5">
        <h2 class="mb-3 text-lg font-semibold">
          数据同步
        </h2>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-300">
          将您的会话数据与云端同步，确保数据安全和跨设备访问。
        </p>
        <button
          class="group relative w-full overflow-hidden rounded-md bg-blue-500 px-4 py-3 text-white font-medium shadow-sm transition-all duration-300 dark:bg-blue-600 hover:bg-blue-600 disabled:opacity-70 hover:shadow-md dark:hover:bg-blue-700"
          :disabled="!canStartSync"
          @click="handleSync"
        >
          <span v-if="isSyncing" class="flex items-center justify-center">
            <span class="mr-2 inline-block animate-spin">⟳</span>
            <span>同步进行中...</span>
          </span>
          <span v-else class="flex items-center justify-center">
            <span class="mr-2">↻</span>
            <span>开始同步</span>
          </span>
          <span
            class="absolute bottom-0 left-0 h-1 bg-blue-400 transition-all duration-500"
            :class="{ 'w-full': isSyncing, 'w-0': !isSyncing }"
          />
        </button>
      </div>
    </div>

    <!-- Sync Progress Panel -->
    <div
      v-if="currentCommand"
      class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100"
    >
      <div class="p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="flex items-center text-lg font-semibold">
            <span class="mr-2">同步状态</span>
            <span
              v-if="currentCommand.status === 'running'"
              class="inline-block animate-spin text-yellow-500"
            >⟳</span>
          </h2>
          <span
            class="flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors"
            :class="{
              'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100':
                currentCommand.status === 'waiting',
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100':
                currentCommand.status === 'running',
              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100':
                currentCommand.status === 'completed',
              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100':
                currentCommand.status === 'failed',
            }"
          >
            <span class="mr-1.5">{{ statusIcon }}</span>
            <span>{{ syncStatus }}</span>
          </span>
        </div>

        <!-- Progress bar -->
        <div class="mb-5">
          <div class="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              class="h-3 rounded-full transition-all duration-500 ease-in-out"
              :class="{
                'bg-blue-600 animate-pulse': currentCommand?.status === 'waiting',
                'bg-yellow-500': currentCommand?.status === 'running',
                'bg-green-500': currentCommand?.status === 'completed',
                'bg-red-500': currentCommand?.status === 'failed',
              }"
              :style="{ width: `${syncProgress}%` }"
            />
          </div>
          <div class="mt-2 flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>进度</span>
            <span class="font-medium">{{ syncProgress }}%</span>
          </div>
        </div>

        <!-- Sync details -->
        <div v-if="syncDetails" class="mt-4 rounded-md bg-gray-50 p-4 space-y-3 dark:bg-gray-700/50">
          <h3 class="mb-2 text-gray-700 font-medium dark:text-gray-200">
            同步详情
          </h3>
          <div
            v-if="syncDetails.totalChats !== undefined && syncDetails.processedChats !== undefined"
            class="flex items-center justify-between"
          >
            <span class="text-gray-600 dark:text-gray-300">会话同步：</span>
            <span class="font-medium">{{ formatNumber(syncDetails.processedChats) }} / {{ formatNumber(syncDetails.totalChats) }}</span>
          </div>
          <div
            v-if="syncDetails.totalFolders !== undefined && syncDetails.processedFolders !== undefined"
            class="flex items-center justify-between"
          >
            <span class="text-gray-600 dark:text-gray-300">文件夹同步：</span>
            <span class="font-medium">{{ formatNumber(syncDetails.processedFolders) }} / {{ formatNumber(syncDetails.totalFolders) }}</span>
          </div>

          <!-- Error message if sync failed -->
          <div
            v-if="currentCommand.status === 'failed' && currentCommand.error"
            class="animate-fadeIn mt-4 rounded-md bg-red-50 p-3 text-red-700 dark:bg-red-900/50 dark:text-red-100"
          >
            <p class="mb-1 font-medium">
              错误信息:
            </p>
            <p class="text-sm">
              {{ currentCommand.error }}
            </p>
          </div>
        </div>

        <!-- Completion message -->
        <div
          v-if="currentCommand.status === 'completed'"
          class="animate-fadeIn mt-4 rounded-md bg-green-50 p-3 text-green-700 dark:bg-green-900/50 dark:text-green-100"
        >
          <p class="flex items-center">
            <span class="mr-2 text-lg">✓</span>
            <span>同步已完成！您的数据已成功同步。</span>
          </p>
        </div>
      </div>
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
