<!-- Export command component -->
<script setup lang="ts">
import type { PublicChat } from '@tg-search/server/types'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useCommands } from '../../composables/useCommands'

// Props
const props = defineProps<{
  chats: PublicChat[]
  loading: boolean
}>()

const { executeExport } = useCommands()

// Selected chat type
const selectedChatType = ref<'user' | 'group' | 'channel'>('user')
// Selected chat
const selectedChatId = ref<number>()
// Selected message types
const selectedMessageTypes = ref<string[]>(['text'])
// Selected export method
const selectedMethod = ref<'getMessage' | 'takeout'>('takeout')

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
  return props.chats.filter((chat: PublicChat) => chat.type === selectedChatType.value)
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

  await executeExport({
    chatId: selectedChatId.value,
    messageTypes: selectedMessageTypes.value,
    method: selectedMethod.value,
  })
}
</script>

<template>
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
        :disabled="loading"
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
        :disabled="loading"
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
      <div class="space-y-2">
        <label
          v-for="option in messageTypeOptions"
          :key="option.value"
          class="flex items-center"
        >
          <input
            v-model="selectedMessageTypes"
            type="checkbox"
            :value="option.value"
            class="border-gray-300 rounded text-blue-600 dark:border-gray-600 dark:bg-gray-700"
            :disabled="loading"
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
        :disabled="loading"
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

    <!-- Export button -->
    <button
      class="w-full rounded bg-blue-500 px-4 py-2 text-white dark:bg-blue-600 hover:bg-blue-600 disabled:opacity-50 dark:hover:bg-blue-700"
      :disabled="loading || !selectedChatId || selectedMessageTypes.length === 0"
      @click="handleExport"
    >
      开始导出
    </button>
  </div>
</template>
