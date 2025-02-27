<!-- Export command component -->
<script setup lang="ts">
import type { TelegramChat } from '@tg-search/core'
import type { DatabaseMessageType } from '@tg-search/db'
import type { ExportDetails } from '@tg-search/server'
import { computed, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useExport } from '../../apis/commands/useExport'

// Props
const props = defineProps<{
  chats: TelegramChat[]
}>()

const {
  executeExport,
  currentCommand,
  exportProgress,
  cleanup,
} = useExport()

// Cleanup when component is unmounted
onUnmounted(() => {
  cleanup()
})

// Selected chat type
const selectedChatType = ref<'user' | 'group' | 'channel'>('user')
// Selected chat
const selectedChatId = ref<number>()
// Selected message types
const selectedMessageTypes = ref<DatabaseMessageType[]>(['text'])
// Selected export method
const selectedMethod = ref<'getMessage' | 'takeout'>('getMessage')
// 增量导出选项
const enableIncremental = ref<boolean>(false)
// 自定义开始消息ID
const customMinId = ref<number | undefined>(undefined)

// Chat type options
const chatTypeOptions = [
  { label: '私聊', value: 'user' },
  { label: '群组', value: 'group' },
  { label: '频道', value: 'channel' },
]

// Message type options
const messageTypeOptions = [
  { label: '文本消息', value: 'text' },
  { label: '图片', value: 'photo' },
  { label: '视频', value: 'video' },
  { label: '文档', value: 'document' },
  { label: '贴纸', value: 'sticker' },
  { label: '其他', value: 'other' },
]

// Export method options
const exportMethodOptions = [
  { label: 'GetMessage', value: 'getMessage' },
  { label: 'Takeout', value: 'takeout' },
]

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

// Filtered chats based on selected type
const filteredChats = computed(() => {
  return props.chats.filter((chat: TelegramChat) => chat.type === selectedChatType.value)
})

// Start export command
async function handleExport() {
  if (!selectedChatId.value) {
    toast.error('请选择要导出的会话')
    return
  }

  if (selectedMessageTypes.value.length === 0) {
    toast.error('请选择要导出的消息类型')
    return
  }

  const toastId = toast.loading('正在准备导出...')
  try {
    const result = await executeExport({
      chatId: selectedChatId.value,
      messageTypes: selectedMessageTypes.value,
      method: selectedMethod.value,
      // 添加增量导出相关参数
      incremental: enableIncremental.value,
      minId: customMinId.value,
    })

    if (!result.success) {
      toast.error(result.error || '导出失败', { id: toastId })
    }
    else {
      toast.success('导出已开始', { id: toastId })
    }
  }
  catch (error) {
    toast.error(`导出错误: ${error instanceof Error ? error.message : '未知错误'}`, { id: toastId })
  }
}

// Computed properties for progress display
const isExporting = computed(() => currentCommand.value?.status === 'running')
const isWaiting = computed(() => currentCommand.value?.status === 'waiting')
const waitingTimeLeft = ref(0)
let countdownTimer: number | undefined

// 获取从metadata中的总消息数和已处理消息数
const totalMessages = computed(() => currentCommand.value?.metadata?.totalMessages as number | undefined)
const processedMessages = computed(() => currentCommand.value?.metadata?.processedMessages as number | undefined)

// 每秒更新剩余等待时间
function startCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  const waitSeconds = currentCommand.value?.metadata?.waitSeconds
  if (!waitSeconds || typeof waitSeconds !== 'number') {
    return
  }

  waitingTimeLeft.value = waitSeconds

  countdownTimer = window.setInterval(() => {
    if (waitingTimeLeft.value <= 0) {
      clearInterval(countdownTimer)
      return
    }
    waitingTimeLeft.value -= 1
  }, 1000)
}

// 当命令状态更新时检查是否需要启动倒计时
watch(() => currentCommand.value?.status, (newStatus) => {
  if (newStatus === 'waiting') {
    startCountdown()
  }
  else if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})

// 组件卸载时清理倒计时
onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
  cleanup()
})

const exportStatus = computed(() => {
  if (!currentCommand.value)
    return ''
  switch (currentCommand.value.status) {
    case 'running':
      return '导出中'
    case 'waiting':
      return `API限制中，等待恢复 (${waitingTimeLeft.value}秒)`
    case 'completed':
      return '导出完成'
    case 'failed':
      return '导出失败'
    default:
      return '准备导出'
  }
})

const exportDetails = computed(() => {
  if (!currentCommand.value || !currentCommand.value.metadata)
    return null

  // 从 metadata 获取需要的字段组成 ExportDetails
  return {
    totalMessages: currentCommand.value.metadata.totalMessages as number | undefined,
    processedMessages: currentCommand.value.metadata.processedMessages as number | undefined,
    failedMessages: currentCommand.value.metadata.failedMessages as number | undefined,
    currentBatch: currentCommand.value.metadata.currentBatch as number | undefined,
    totalBatches: currentCommand.value.metadata.totalBatches as number | undefined,
    currentSpeed: currentCommand.value.metadata.currentSpeed as string | undefined,
    estimatedTimeRemaining: currentCommand.value.metadata.estimatedTimeRemaining as string | undefined,
    totalDuration: currentCommand.value.metadata.totalDuration as string | undefined,
    error: currentCommand.value.metadata.error,
  } as ExportDetails
})

// Format speed for display
function formatSpeed(speed: string): string {
  const match = speed.match(/(\d+)/)
  if (!match)
    return speed
  const value = Number.parseInt(match[1])
  if (value < 1)
    return '< 1 消息/秒'
  if (value > 1000)
    return `${(value / 1000).toFixed(1)}k 消息/秒`
  return `${value} 消息/秒`
}

// Format time for display
function formatTime(time: string): string {
  const match = time.match(/(\d+)/)
  if (!match)
    return time
  const value = Number.parseInt(match[1])
  if (value < 60)
    return `${value} 秒`
  if (value < 3600)
    return `${Math.floor(value / 60)} 分 ${value % 60} 秒`
  return `${Math.floor(value / 3600)} 小时 ${Math.floor((value % 3600) / 60)} 分`
}

// Format number with commas
function formatNumber(num: number | undefined): string {
  if (num === undefined)
    return '0'
  return num.toLocaleString()
}
</script>

<template>
  <div class="space-y-5">
    <!-- Export settings -->
    <div class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100">
      <div class="p-5">
        <h2 class="mb-4 text-lg font-semibold">
          导出设置
        </h2>

        <!-- Chat type selection -->
        <div class="mb-4">
          <label class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
            会话类型
          </label>
          <div class="relative">
            <select
              v-model="selectedChatType"
              class="w-full appearance-none border border-gray-300 rounded-md bg-white px-4 py-2.5 pr-10 transition-colors dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:border-blue-500 dark:focus:ring-blue-700/30"
              :disabled="isExporting"
            >
              <option
                v-for="option in chatTypeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
              <span>▼</span>
            </div>
          </div>
        </div>

        <!-- Chat selection -->
        <div class="mb-4">
          <label class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
            选择会话
          </label>
          <div class="relative">
            <select
              v-model="selectedChatId"
              class="w-full appearance-none border border-gray-300 rounded-md bg-white px-4 py-2.5 pr-10 transition-colors dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:border-blue-500 dark:focus:ring-blue-700/30"
              :disabled="isExporting"
            >
              <option value="">
                请选择会话
              </option>
              <option
                v-for="chat in filteredChats"
                :key="chat.id"
                :value="chat.id"
              >
                {{ chat.title }}
              </option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
              <span>▼</span>
            </div>
          </div>
        </div>

        <!-- Message type selection -->
        <div class="mb-5">
          <label class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
            消息类型
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label
              v-for="option in messageTypeOptions"
              :key="option.value"
              class="flex cursor-pointer items-center border border-gray-200 rounded-md p-3 transition-colors dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/70"
              :class="{ 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20': selectedMessageTypes.includes(option.value as DatabaseMessageType) }"
            >
              <input
                v-model="selectedMessageTypes"
                type="checkbox"
                :value="option.value"
                class="h-4 w-4 border-gray-300 rounded text-blue-600 transition-colors dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500"
                :disabled="isExporting"
              >
              <span class="ml-2.5 text-sm">{{ option.label }}</span>
            </label>
          </div>
        </div>

        <!-- Export method selection -->
        <div class="mb-5">
          <label class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
            导出方式
          </label>
          <div class="space-y-2.5">
            <label
              v-for="option in exportMethodOptions"
              :key="option.value"
              class="flex cursor-pointer items-center border border-gray-200 rounded-md p-3 transition-colors dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/70"
              :class="{ 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20': selectedMethod === option.value }"
            >
              <input
                v-model="selectedMethod"
                type="radio"
                :value="option.value"
                class="h-4 w-4 border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500"
                :disabled="isExporting"
              >
              <span class="ml-2.5 text-sm">{{ option.label }}</span>
            </label>
          </div>
        </div>

        <!-- 增量导出选项 -->
        <div class="mb-5 rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="mb-3 flex items-center">
            <input
              id="incrementalExport"
              v-model="enableIncremental"
              type="checkbox"
              class="h-4 w-4 border-gray-300 rounded text-blue-600 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500"
              :disabled="isExporting"
            >
            <label for="incrementalExport" class="ml-2.5 text-sm text-gray-700 font-medium dark:text-gray-300">
              增量导出（仅导出上次导出后的新消息）
            </label>
          </div>

          <div v-if="!enableIncremental" class="mt-3">
            <label class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
              自定义起始消息ID（可选）
            </label>
            <input
              v-model.number="customMinId"
              type="number"
              placeholder="从此ID开始导出（留空则从最新消息开始）"
              class="w-full border border-gray-300 rounded-md bg-white px-4 py-2.5 transition-colors dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:border-blue-500 dark:focus:ring-blue-700/30"
              :disabled="isExporting"
            >
          </div>
        </div>

        <!-- Export button -->
        <button
          class="group relative w-full overflow-hidden rounded-md bg-blue-500 px-4 py-3 text-white font-medium shadow-sm transition-all duration-300 dark:bg-blue-600 hover:bg-blue-600 disabled:opacity-70 hover:shadow-md dark:hover:bg-blue-700"
          :disabled="isExporting || !selectedChatId || selectedMessageTypes.length === 0"
          @click="handleExport"
        >
          <span v-if="isExporting" class="flex items-center justify-center">
            <span class="mr-2 inline-block animate-spin">⟳</span>
            <span>导出进行中...</span>
          </span>
          <span v-else class="flex items-center justify-center">
            <span class="mr-2">↻</span>
            <span>开始导出</span>
          </span>
          <span
            class="absolute bottom-0 left-0 h-1 bg-blue-400 transition-all duration-500"
            :class="{ 'w-full': isExporting, 'w-0': !isExporting }"
          />
        </button>
      </div>
    </div>

    <!-- Export progress -->
    <div
      v-if="currentCommand"
      class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100"
    >
      <div class="p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="flex items-center text-lg font-semibold">
            <span class="mr-2">导出状态</span>
            <span
              v-if="currentCommand.status === 'running'"
              class="inline-block animate-spin text-yellow-500"
            >⟳</span>
          </h2>
          <span
            class="flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors"
            :class="{
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100': isWaiting,
              'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100': currentCommand.status === 'running',
              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100': currentCommand.status === 'completed',
              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100': currentCommand.status === 'failed',
            }"
          >
            <span class="mr-1.5">{{ statusIcon }}</span>
            <span>{{ exportStatus }}</span>
          </span>
        </div>

        <!-- Progress bar -->
        <div class="mb-5">
          <div class="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              class="h-3 rounded-full transition-all duration-500 ease-in-out"
              :class="{
                'bg-yellow-500 animate-pulse': isWaiting,
                'bg-blue-500': !isWaiting && currentCommand?.status !== 'failed',
                'bg-red-500': currentCommand?.status === 'failed',
              }"
              :style="{ width: `${exportProgress}%` }"
            />
          </div>
          <div class="mt-2 flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>进度</span>
            <span class="font-medium">{{ exportProgress }}%</span>
          </div>
        </div>

        <!-- 等待提示 -->
        <div v-if="isWaiting" class="animate-fadeIn mb-5 rounded-md bg-yellow-50 p-3 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
          <p class="flex items-center">
            <span class="mr-2 text-lg">⏱</span>
            <span>Telegram API 限制中...将在 {{ waitingTimeLeft }} 秒后恢复。</span>
          </p>
        </div>

        <!-- Status message -->
        <div v-if="currentCommand.message" class="mb-4 text-sm text-gray-700 dark:text-gray-300">
          <p class="mb-1 font-medium">
            当前状态:
          </p>
          <p>
            {{ currentCommand.message }}
            <template v-if="currentCommand.message?.includes('已处理')">
              <span
                v-if="!!totalMessages && !!processedMessages"
                class="text-blue-600 font-medium dark:text-blue-400"
              >
                ({{ formatNumber(processedMessages) }} / {{ formatNumber(totalMessages) }} 条)
              </span>
              <span
                v-else-if="exportDetails?.totalMessages"
                class="text-blue-600 font-medium dark:text-blue-400"
              >
                (共 {{ formatNumber(exportDetails.totalMessages) }} 条)
              </span>
            </template>
          </p>
        </div>

        <!-- Export details -->
        <div v-if="exportDetails" class="mt-6 space-y-4">
          <h3 class="text-gray-800 font-medium dark:text-gray-200">
            导出详情
          </h3>

          <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
            <div class="text-sm space-y-3">
              <div v-if="exportDetails.totalMessages !== undefined" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">总消息数：</span>
                <span class="font-medium">{{ formatNumber(exportDetails.totalMessages) }}</span>
              </div>

              <div v-if="exportDetails.processedMessages !== undefined" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">已处理消息：</span>
                <span class="flex items-center font-medium">
                  {{ formatNumber(exportDetails.processedMessages) }}
                  <template v-if="exportDetails.totalMessages !== undefined">
                    <span class="mx-1">/</span> {{ formatNumber(exportDetails.totalMessages) }}
                  </template>
                </span>
              </div>

              <div v-if="exportDetails.failedMessages" class="flex items-center justify-between text-red-600 dark:text-red-400">
                <span>失败消息：</span>
                <span class="font-medium">{{ formatNumber(exportDetails.failedMessages) }}</span>
              </div>

              <div v-if="exportDetails.currentBatch && exportDetails.totalBatches" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">当前批次：</span>
                <span class="font-medium">{{ exportDetails.currentBatch }} / {{ exportDetails.totalBatches }}</span>
              </div>
            </div>
          </div>

          <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
            <div class="text-sm space-y-3">
              <div v-if="exportDetails.currentSpeed" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">当前速度：</span>
                <span class="font-medium">{{ formatSpeed(exportDetails.currentSpeed) }}</span>
              </div>

              <div v-if="exportDetails.estimatedTimeRemaining" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">预计剩余时间：</span>
                <span class="font-medium">{{ formatTime(exportDetails.estimatedTimeRemaining) }}</span>
              </div>

              <div v-if="exportDetails.totalDuration" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">总耗时：</span>
                <span class="font-medium">{{ formatTime(exportDetails.totalDuration) }}</span>
              </div>
            </div>
          </div>

          <div v-if="exportDetails.error" class="animate-fadeIn mt-4 rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/50 dark:text-red-100">
            <p class="mb-2 font-medium">
              错误信息:
            </p>
            <div v-if="typeof exportDetails.error === 'string'" class="text-sm">
              {{ exportDetails.error }}
            </div>
            <div v-else class="text-sm">
              <div>{{ exportDetails.error.name }}: {{ exportDetails.error.message }}</div>
              <pre v-if="exportDetails.error.stack" class="mt-3 overflow-auto rounded-md bg-red-100 p-2 text-xs dark:bg-red-900/50">{{ exportDetails.error.stack }}</pre>
            </div>
          </div>
        </div>

        <!-- Completion message -->
        <div
          v-if="currentCommand.status === 'completed'"
          class="animate-fadeIn mt-5 rounded-md bg-green-50 p-3 text-green-700 dark:bg-green-900/50 dark:text-green-100"
        >
          <p class="flex items-center">
            <span class="mr-2 text-lg">✓</span>
            <span>导出已完成！您可以在数据库中查看导出的消息。</span>
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

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
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

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
