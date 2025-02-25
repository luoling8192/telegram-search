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
  { label: 'Takeout (推荐，可能需要等待)', value: 'takeout' },
  { label: 'GetMessage (立即导出，可能不完整)', value: 'getMessage' },
]

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

  const toastId = toast.loading('正在导出...')
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
    toast.success('导出成功', { id: toastId })
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
    // 其他字段可能没有，暂时不处理
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
</script>

<template>
  <div class="space-y-4">
    <!-- Export settings -->
    <div class="rounded bg-white p-4 shadow dark:bg-gray-800 dark:text-gray-100">
      <h2 class="mb-2 text-lg font-semibold">
        导出设置
      </h2>

      <!-- Chat type selection -->
      <div class="mb-4">
        <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
          会话类型
        </label>
        <select
          v-model="selectedChatType"
          class="w-full border border-gray-300 rounded bg-white p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
      </div>

      <!-- Chat selection -->
      <div class="mb-4">
        <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
          选择会话
        </label>
        <select
          v-model="selectedChatId"
          class="w-full border border-gray-300 rounded bg-white p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
      </div>

      <!-- Message type selection -->
      <div class="mb-4">
        <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
          消息类型
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label
            v-for="option in messageTypeOptions"
            :key="option.value"
            class="flex items-center border border-gray-200 rounded p-2 dark:border-gray-700"
          >
            <input
              v-model="selectedMessageTypes"
              type="checkbox"
              :value="option.value"
              class="border-gray-300 rounded text-blue-600 dark:border-gray-600 dark:bg-gray-700"
              :disabled="isExporting"
            >
            <span class="ml-2">{{ option.label }}</span>
          </label>
        </div>
      </div>

      <!-- Export method selection -->
      <div class="mb-4">
        <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
          导出方式
        </label>
        <select
          v-model="selectedMethod"
          class="w-full border border-gray-300 rounded bg-white p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          :disabled="isExporting"
        >
          <option
            v-for="option in exportMethodOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- 增量导出选项 -->
      <div class="mb-4">
        <div class="mb-2 flex items-center">
          <input
            id="incrementalExport"
            v-model="enableIncremental"
            type="checkbox"
            class="border-gray-300 rounded text-blue-600 dark:border-gray-600 dark:bg-gray-700"
            :disabled="isExporting"
          >
          <label for="incrementalExport" class="ml-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            增量导出（仅导出上次导出后的新消息）
          </label>
        </div>

        <div v-if="!enableIncremental" class="mt-2">
          <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
            自定义起始消息ID（可选）
          </label>
          <input
            v-model.number="customMinId"
            type="number"
            placeholder="从此ID开始导出（留空则从最新消息开始）"
            class="w-full border border-gray-300 rounded bg-white p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            :disabled="isExporting"
          >
        </div>
      </div>

      <!-- Export button -->
      <button
        class="w-full rounded bg-blue-500 px-4 py-2 text-white dark:bg-blue-600 hover:bg-blue-600 disabled:opacity-50 dark:hover:bg-blue-700"
        :disabled="isExporting || !selectedChatId || selectedMessageTypes.length === 0"
        @click="handleExport"
      >
        {{ isExporting ? '导出中...' : '开始导出' }}
      </button>
    </div>

    <!-- Export progress -->
    <div
      v-if="currentCommand"
      class="rounded bg-white p-4 shadow dark:bg-gray-800 dark:text-gray-100"
    >
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          导出进度
        </h2>
        <span
          class="rounded px-2 py-1 text-sm"
          :class="{
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100': currentCommand.status === 'running',
            'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100': currentCommand.status === 'completed',
            'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100': currentCommand.status === 'failed',
          }"
        >
          {{ exportStatus }}
        </span>
      </div>

      <!-- Progress bar -->
      <div class="mb-4">
        <div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            class="h-2 rounded-full"
            :class="{
              'bg-blue-600': !isWaiting && currentCommand?.status !== 'failed',
              'bg-yellow-500': isWaiting,
              'bg-red-500': currentCommand?.status === 'failed',
            }"
            :style="{ width: `${exportProgress}%` }"
          />
        </div>
        <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ exportProgress }}%
        </div>
      </div>

      <!-- 等待提示 -->
      <div v-if="isWaiting" class="mt-2 rounded bg-yellow-100 p-2 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-200">
        <p class="flex items-center">
          <span class="i-tabler-hourglass-high mr-2 animate-pulse" />
          Telegram API 限制中...将在 {{ waitingTimeLeft }} 秒后恢复。
        </p>
      </div>

      <!-- Status message -->
      <div class="mb-4 text-sm">
        {{ currentCommand.message }}
        <template v-if="currentCommand.message?.includes('已处理')">
          <span v-if="totalMessages && processedMessages">
            ({{ processedMessages.toLocaleString() }} / {{ totalMessages.toLocaleString() }} 条)
          </span>
          <span v-else-if="exportDetails?.totalMessages">
            (共 {{ exportDetails.totalMessages.toLocaleString() }} 条)
          </span>
        </template>
      </div>

      <!-- Export details -->
      <div v-if="exportDetails" class="text-sm space-y-2">
        <div v-if="exportDetails.totalMessages" class="flex justify-between">
          <span>总消息数：</span>
          <span>{{ exportDetails.totalMessages.toLocaleString() }}</span>
        </div>
        <div v-if="exportDetails.processedMessages" class="flex justify-between">
          <span>已处理消息：</span>
          <span>
            {{ exportDetails.processedMessages.toLocaleString() }}
            <template v-if="exportDetails.totalMessages">
              / {{ exportDetails.totalMessages.toLocaleString() }}
            </template>
          </span>
        </div>
        <div v-if="exportDetails.failedMessages" class="flex justify-between text-red-600">
          <span>失败消息：</span>
          <span>{{ exportDetails.failedMessages.toLocaleString() }}</span>
        </div>
        <div v-if="exportDetails.currentBatch && exportDetails.totalBatches" class="flex justify-between">
          <span>当前批次：</span>
          <span>{{ exportDetails.currentBatch }} / {{ exportDetails.totalBatches }}</span>
        </div>
        <div v-if="exportDetails.currentSpeed" class="flex justify-between">
          <span>当前速度：</span>
          <span>{{ formatSpeed(exportDetails.currentSpeed) }}</span>
        </div>
        <div v-if="exportDetails.estimatedTimeRemaining" class="flex justify-between">
          <span>预计剩余时间：</span>
          <span>{{ formatTime(exportDetails.estimatedTimeRemaining) }}</span>
        </div>
        <div v-if="exportDetails.totalDuration" class="flex justify-between">
          <span>总耗时：</span>
          <span>{{ formatTime(exportDetails.totalDuration) }}</span>
        </div>
        <div v-if="exportDetails.error" class="mt-4 rounded bg-red-100 p-2 text-red-800 dark:bg-red-900 dark:text-red-100">
          <div v-if="typeof exportDetails.error === 'string'">
            {{ exportDetails.error }}
          </div>
          <div v-else>
            <div>{{ exportDetails.error.name }}: {{ exportDetails.error.message }}</div>
            <pre v-if="exportDetails.error.stack" class="mt-2 overflow-auto text-xs">{{ exportDetails.error.stack }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
