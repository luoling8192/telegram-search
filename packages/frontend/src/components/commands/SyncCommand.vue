<script setup lang="ts">
import type { SyncDetails } from '../../../../server/src/types/apis/sync'
import { computed, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { useSync } from '../../apis/commands/useSync'

const { executeSync, currentCommand, syncProgress, cleanup } = useSync()

// Cleanup when component is unmounted
onUnmounted(() => {
  cleanup()
})

const syncDetails = computed(() => {
  if (!currentCommand.value || !currentCommand.value.metadata) {
    return null
  }

  const metadata = currentCommand.value.metadata
  return {
    totalChats: metadata.totalChats as number | undefined,
    totalFolders: metadata.totalFolders as number | undefined,
    processedChats: metadata.processedChats as number | undefined,
    processedFolders: metadata.processedFolders as number | undefined,
  } as SyncDetails
})

const syncStatus = computed(() => {
  if (!currentCommand.value) {
    return ''
  }
  switch (currentCommand.value.status) {
    case 'running':
      return '同步中'
    case 'waiting':
      return `等待中`
    case 'completed':
      return '同步完成'
    case 'failed':
      return '同步失败'
    default:
      return '准备同步'
  }
})

// Start sync command
async function handleSync() {
  const toastId = toast.loading('正在导出...')
  const result = await executeSync({})
  if (!result.success) {
    toast.error(result.error || '同步失败', { id: toastId })
  }
  else {
    toast.success('同步成功', { id: toastId })
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded bg-white p-4 shadow dark:bg-gray-800 dark:text-gray-100">
      <button
        class="w-full rounded bg-blue-500 px-4 py-2 text-white dark:bg-blue-600 hover:bg-blue-600 disabled:opacity-50 dark:hover:bg-blue-700"
        @click="handleSync"
      >
        开始同步
      </button>
    </div>

    <div
      v-if="currentCommand"
      class="rounded bg-white p-4 shadow dark:bg-gray-800 dark:text-gray-100"
    >
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          同步进度
        </h2>
        <span
          class="rounded px-2 py-1 text-sm"
          :class="{
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100':
              currentCommand.status === 'running',
            'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100':
              currentCommand.status === 'completed',
            'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100':
              currentCommand.status === 'failed',
          }"
        >
          {{ syncStatus }}
        </span>
      </div>
      <!-- Progress bar -->
      <div class="mb-4">
        <div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            class="h-2 rounded-full"
            :class="{
              'bg-blue-600': currentCommand?.status !== 'failed',
              'bg-red-500': currentCommand?.status === 'failed',
            }"
            :style="{ width: `${syncProgress}%` }"
          />
        </div>
        <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ syncProgress }}%
        </div>
      </div>
      <div v-if="syncDetails" class="text-sm space-y-2">
        <div
          v-if="!!syncDetails.totalChats && !!syncDetails.processedChats"
          class="flex justify-between"
        >
          <span>会话同步数量：</span>
          <span>{{ syncDetails.processedChats.toLocaleString() }}/{{
            syncDetails.totalChats.toLocaleString()
          }}</span>
        </div>
        <div
          v-if="!!syncDetails.totalFolders && !!syncDetails.processedFolders"
          class="flex justify-between"
        >
          <span>文件同步数量：</span>
          <span>{{ syncDetails.processedFolders.toLocaleString() }}/{{
            syncDetails.totalFolders.toLocaleString()
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
