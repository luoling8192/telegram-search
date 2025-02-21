<!-- Export command component -->
<script setup lang="ts">
import type { PublicChat } from '@tg-search/server/types'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useCommands } from '../../composables/useCommands'

const { executeExport } = useCommands()

// Props
defineProps<{
  chats: PublicChat[]
  loading: boolean
}>()

// Selected chat
const selectedChatId = ref<number>()
// Selected message types
const selectedMessageTypes = ref<string[]>(['text'])

// Message type options
const messageTypeOptions = [
  { label: '文本消息', value: 'text' },
  { label: '图片', value: 'photo' },
  { label: '视频', value: 'video' },
  { label: '文档', value: 'document' },
  { label: '贴纸', value: 'sticker' },
  { label: '其他', value: 'other' },
]

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
  })
}
</script>

<template>
  <div class="rounded bg-white p-4 shadow">
    <h2 class="mb-2 text-lg font-semibold">
      导出设置
    </h2>

    <!-- Chat selection -->
    <div class="mb-4">
      <label class="mb-1 block text-sm font-medium text-gray-700">
        选择会话
      </label>
      <select
        v-model="selectedChatId"
        class="w-full rounded border border-gray-300 p-2"
        :disabled="loading"
      >
        <option value="">请选择会话</option>
        <option
          v-for="chat in chats"
          :key="chat.id"
          :value="chat.id"
        >
          [{{ chat.type }}] {{ chat.title }}
        </option>
      </select>
    </div>

    <!-- Message type selection -->
    <div class="mb-4">
      <label class="mb-1 block text-sm font-medium text-gray-700">
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
            class="rounded border-gray-300 text-blue-600"
            :disabled="loading"
          >
          <span class="ml-2">{{ option.label }}</span>
        </label>
      </div>
    </div>

    <!-- Export button -->
    <button
      class="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
      :disabled="loading || !selectedChatId || selectedMessageTypes.length === 0"
      @click="handleExport"
    >
      开始导出
    </button>
  </div>
</template> 
