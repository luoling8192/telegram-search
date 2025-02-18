<!-- Message bubble component for displaying PublicMessage -->
<script setup lang="ts">
import type { PublicMessage } from '@tg-search/server/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

const props = defineProps<{
  message: PublicMessage
  // Current user ID to determine message direction
  currentUserId?: number
  // Previous message in the chat
  previousMessage?: PublicMessage
  // Next message in the chat
  nextMessage?: PublicMessage
}>()

const emit = defineEmits<{
  (e: 'jumpToMessage', messageId: number): void
}>()

// Check if message is from current user
const isSelf = computed(() => props.message.fromId === props.currentUserId)

// Check if this message should show sender info
const shouldShowSender = computed(() => {
  if (!props.previousMessage)
    return true

  // Show sender if previous message is from different sender
  if (props.previousMessage.fromId !== props.message.fromId)
    return true

  // Show sender if messages are more than 5 minutes apart
  const prevTime = new Date(props.previousMessage.createdAt).getTime()
  const currentTime = new Date(props.message.createdAt).getTime()
  return (currentTime - prevTime) > 5 * 60 * 1000
})

// Get bubble position class
const bubblePositionClass = computed(() => {
  const classes = []

  // Basic alignment
  classes.push(isSelf.value ? 'self-end' : 'self-start')

  return classes
})

// Get bubble content class
const bubbleContentClass = computed(() => {
  const classes = []

  // Base styles
  classes.push('p-3 transition-colors duration-300')

  // Background color
  if (isSelf.value) {
    classes.push('bg-blue-500 text-white')
  }
  else {
    classes.push('bg-gray-100 dark:bg-gray-800')
  }

  // Top radius
  if (shouldShowSender.value) {
    classes.push(isSelf.value ? 'rounded-tr-3xl rounded-tl-2xl' : 'rounded-tl-3xl rounded-tr-2xl')
  }
  else {
    classes.push(isSelf.value ? 'rounded-tr-md rounded-tl-2xl' : 'rounded-tl-md rounded-tr-2xl')
  }

  // Bottom radius
  if (!props.nextMessage || props.nextMessage.fromId !== props.message.fromId) {
    classes.push(isSelf.value ? 'rounded-br-3xl rounded-bl-2xl' : 'rounded-bl-3xl rounded-br-2xl')
  }
  else {
    classes.push(isSelf.value ? 'rounded-br-md rounded-bl-2xl' : 'rounded-bl-md rounded-br-2xl')
  }

  return classes
})

// Get bubble spacing class
const bubbleSpacingClass = computed(() => {
  if (!props.nextMessage || props.nextMessage.fromId !== props.message.fromId) {
    return 'mb-4'
  }
  return 'mb-[2px]'
})

// Format time to HH:mm
function formatTime(date: Date | string): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  return dateObj.toLocaleTimeString('default', {
    hour: '2-digit',
    minute: '2-digit',
  })
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
    class="group message-bubble"
    :class="[bubblePositionClass, bubbleSpacingClass]"
  >
    <!-- Sender info -->
    <div v-if="shouldShowSender" class="mb-1 text-left text-sm text-gray-500 dark:text-gray-400">
      <span class="text-blue-500 font-medium dark:text-blue-400">{{ message.fromName }}</span>
      <span class="mx-1">•</span>
      <span class="text-gray-400 dark:text-gray-500">{{ formatTime(message.createdAt) }}</span>
    </div>

    <!-- Message content -->
    <div :class="bubbleContentClass">
      <!-- Text content -->
      <div v-if="message.content" class="whitespace-pre-wrap text-left">
        {{ message.content }}
      </div>

      <!-- Media content -->
      <div v-if="message.mediaInfo" class="mt-2">
        <!-- Photo -->
        <div v-if="message.mediaInfo.type === 'photo'">
          <img
            v-if="message.mediaInfo.width && message.mediaInfo.height"
            :src="`/api/media/${message.chatId}/${message.id}`"
            :alt="message.mediaInfo.fileName || 'Photo'"
            class="max-w-full rounded-lg"
            :style="{
              width: `${message.mediaInfo.width}px`,
              height: `${message.mediaInfo.height}px`,
            }"
          >
          <div v-else class="flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700" style="width: 200px; height: 200px">
            <Icon icon="carbon:image" class="h-12 w-12 text-gray-400" />
          </div>
        </div>

        <!-- Video -->
        <div v-else-if="message.mediaInfo.type === 'video'">
          <video
            v-if="message.mediaInfo.width && message.mediaInfo.height"
            :src="`/api/media/${message.chatId}/${message.id}`"
            :poster="message.mediaInfo.thumbnail ? `/api/media/${message.chatId}/${message.id}/thumbnail` : undefined"
            controls
            class="max-w-full rounded-lg"
            :style="{
              width: `${message.mediaInfo.width}px`,
              height: `${message.mediaInfo.height}px`,
            }"
          />
          <div v-else class="flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700" style="width: 200px; height: 200px">
            <Icon icon="carbon:video" class="h-12 w-12 text-gray-400" />
          </div>
        </div>

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
        <div v-else-if="message.mediaInfo.type === 'sticker'">
          <img
            v-if="message.mediaInfo.width && message.mediaInfo.height"
            :src="`/api/media/${message.chatId}/${message.id}`"
            :alt="message.mediaInfo.fileName || 'Sticker'"
            class="max-h-[238px] max-w-[238px] rounded-lg object-contain"
          >
          <div v-else class="flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700" style="width: 120px; height: 120px">
            <Icon icon="carbon:face-satisfied" class="h-12 w-12 text-gray-400" />
          </div>
        </div>
      </div>

      <!-- Message info -->
      <div
        class="mt-1 flex items-center gap-2 text-left text-xs"
        :class="{
          'text-white/60 group-hover:text-white': isSelf,
          'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300': !isSelf,
        }"
      >
        <span v-if="message.views" class="inline-flex items-center">
          <Icon icon="carbon:view" class="mr-1 h-4 w-4" />
          {{ message.views }}
        </span>
        <span v-if="message.forwards" class="inline-flex items-center">
          <Icon icon="carbon:share" class="mr-1 h-4 w-4" />
          {{ message.forwards }}
        </span>
        <span
          v-if="message.replyToId"
          class="inline-flex cursor-pointer items-center hover:underline"
          @click="emit('jumpToMessage', message.replyToId)"
        >
          <Icon icon="carbon:reply" class="mr-1 h-4 w-4" />
          {{ message.replyToId }}
        </span>
        <span v-if="message.forwardFromChatId" class="inline-flex items-center">
          <Icon icon="carbon:arrow-right" class="mr-1 h-4 w-4" />
          {{ message.forwardFromChatId }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-bubble {
  @apply max-w-[80%];
}

.highlight {
  @apply ring-2 ring-blue-500 dark:ring-blue-400 !important;
}
</style>
