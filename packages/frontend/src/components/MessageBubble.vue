<!-- Message bubble component -->
<script setup lang="ts">
import type { PublicMessage } from '@tg-search/server/types'

defineProps<{
  message: PublicMessage
}>()
</script>

<template>
  <div class="message-bubble">
    <!-- Message timestamp -->
    <div class="mb-1 text-xs text-gray-500">
      {{ new Date(message.date).toLocaleString() }}
    </div>

    <!-- Message content -->
    <div class="rounded-2xl bg-blue-500 px-4 py-2 text-white">
      <!-- Text content -->
      <div class="whitespace-pre-wrap">
        {{ message.text }}
      </div>

      <!-- Media content -->
      <div v-if="message.media" class="mt-2 rounded-lg bg-blue-600 p-2 text-sm">
        <div class="flex items-center gap-2">
          <div class="i-carbon-document text-xl" />
          <div class="flex-1 overflow-hidden">
            <div class="truncate">
              {{ message.media.fileName || message.media.type }}
            </div>
            <div v-if="message.media.fileSize" class="text-blue-200">
              {{ (message.media.fileSize / 1024 / 1024).toFixed(1) }} MB
            </div>
          </div>
        </div>
        <!-- Image/Video dimensions -->
        <div
          v-if="message.media.width && message.media.height"
          class="mt-1 text-xs text-blue-200"
        >
          {{ message.media.width }}x{{ message.media.height }}
          <span v-if="message.media.duration">
            · {{ Math.floor(message.media.duration / 60) }}:{{ (message.media.duration % 60).toString().padStart(2, '0') }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-bubble {
  @apply max-w-[80%] self-end;
}
</style>
