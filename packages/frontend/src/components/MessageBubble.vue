<!-- Message bubble component for displaying PublicMessage -->
<script setup lang="ts">
import type { PublicMessage } from '@tg-search/server/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

const props = defineProps<{
  message: PublicMessage
  // Current user ID to determine message direction
  currentUserId?: number
}>()

const emit = defineEmits<{
  (e: 'jumpToMessage', messageId: number): void
}>()

// Check if message is from current user
const isSelf = computed(() => props.message.fromId === props.currentUserId)

// Format time to HH:mm
function formatTime(date: Date | string): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  return dateObj.toLocaleTimeString('default', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format date to relative time
function formatDate(date: Date | string): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  const now = new Date()
  const diff = now.getTime() - dateObj.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return 'Today'
  }
  else if (days === 1) {
    return 'Yesterday'
  }
  else if (days < 7) {
    return dateObj.toLocaleDateString('default', { weekday: 'long' })
  }
  else {
    return dateObj.toLocaleDateString('default', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
    })
  }
}

// Format file size to human readable string
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size.toFixed(1)} ${units[unit]}`
}
</script>

<template>
  <div
    class="message-bubble group"
    :class="{
      'self-end': isSelf,
      'self-start': !isSelf,
    }"
  >
    <!-- Sender info -->
    <div class="mb-1 text-sm text-gray-500 text-left">
      <span class="font-medium">{{ message.fromName }}</span> • {{ formatDate(message.createdAt) }} {{ formatTime(message.createdAt) }}
    </div>

    <!-- Message content -->
    <div
      class="rounded-lg p-3 transition-colors duration-300"
      :class="{
        'bg-blue-500 text-white': isSelf,
        'bg-gray-100 dark:bg-gray-800': !isSelf,
        'highlight': message.highlight,
      }"
    >
      <!-- Text content -->
      <div v-if="message.content" class="whitespace-pre-wrap text-left">
        {{ message.content }}
      </div>

      <!-- Media content -->
      <div v-if="message.mediaInfo" class="mt-2">
        <!-- Photo -->
        <img
          v-if="message.mediaInfo.type === 'photo'"
          :src="`/api/media/${message.chatId}/${message.id}`"
          :alt="message.mediaInfo.fileName || 'Photo'"
          class="max-w-full rounded-lg"
          :style="{
            width: message.mediaInfo.width ? `${message.mediaInfo.width}px` : 'auto',
            height: message.mediaInfo.height ? `${message.mediaInfo.height}px` : 'auto',
          }"
        >

        <!-- Video -->
        <video
          v-else-if="message.mediaInfo.type === 'video'"
          :src="`/api/media/${message.chatId}/${message.id}`"
          :poster="message.mediaInfo.thumbnail ? `/api/media/${message.chatId}/${message.id}/thumbnail` : undefined"
          controls
          class="max-w-full rounded-lg"
          :style="{
            width: message.mediaInfo.width ? `${message.mediaInfo.width}px` : 'auto',
            height: message.mediaInfo.height ? `${message.mediaInfo.height}px` : 'auto',
          }"
        />

        <!-- Document -->
        <div
          v-else-if="message.mediaInfo.type === 'document'"
          class="flex items-center rounded bg-gray-50 p-2 space-x-2 dark:bg-gray-700"
        >
          <Icon icon="carbon:document" class="h-6 w-6" />
          <div class="flex-1">
            <div class="text-sm font-medium">
              {{ message.mediaInfo.fileName || 'Document' }}
            </div>
            <div class="text-xs text-gray-500">
              {{ message.mediaInfo.fileSize ? formatFileSize(message.mediaInfo.fileSize) : '' }}
            </div>
          </div>
          <a
            :href="`/api/media/${message.chatId}/${message.id}`"
            download
            class="rounded bg-gray-200 px-2 py-1 text-sm dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Download
          </a>
        </div>

        <!-- Sticker -->
        <img
          v-else-if="message.mediaInfo.type === 'sticker'"
          :src="`/api/media/${message.chatId}/${message.id}`"
          :alt="message.mediaInfo.fileName || 'Sticker'"
          class="max-w-full rounded-lg"
          :style="{
            width: message.mediaInfo.width ? `${message.mediaInfo.width}px` : 'auto',
            height: message.mediaInfo.height ? `${message.mediaInfo.height}px` : 'auto',
          }"
        >
      </div>

      <!-- Message info -->
      <div 
        class="mt-1 text-left text-xs"
        :class="{
          'text-white/60 group-hover:text-white': isSelf,
          'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300': !isSelf,
        }"
      >
        <span v-if="message.views" class="mr-2">
          <Icon icon="carbon:view" class="mr-1 inline h-4 w-4" />
          {{ message.views }} views
        </span>
        <span v-if="message.forwards" class="mr-2">
          <Icon icon="carbon:share" class="mr-1 inline h-4 w-4" />
          {{ message.forwards }} forwards
        </span>
        <span 
          v-if="message.replyToId" 
          class="mr-2 cursor-pointer hover:underline"
          @click="emit('jumpToMessage', message.replyToId)"
        >
          <Icon icon="carbon:reply" class="mr-1 inline h-4 w-4" />
          Reply to {{ message.replyToId }}
        </span>
        <span v-if="message.forwardFromChatId" class="mr-2">
          <Icon icon="carbon:arrow-right" class="mr-1 inline h-4 w-4" />
          Forwarded from {{ message.forwardFromChatId }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-bubble {
  @apply max-w-[80%];
}

.message-content {
  @apply rounded-2xl px-4 py-2 shadow-sm;
}

.highlight {
  @apply ring-2 ring-blue-500 dark:ring-blue-400 !important;
}
</style>
