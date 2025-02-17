<!-- Chat messages page -->
<script setup lang="ts">
import type { PublicMessage } from '@tg-search/server/types'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../../composables/api'

// Initialize API client and router
const { loading, error, getMessages } = useApi()
const route = useRoute()
const router = useRouter()
const messages = ref<PublicMessage[]>([])

// Get chat ID from route
const chatId = Number(route.params.id)

// Load messages from chat
async function loadMessages() {
  const response = await getMessages(chatId)
  if (response.data) {
    messages.value = response.data
  }
}

// Load messages on mount
onMounted(() => {
  if (Number.isNaN(chatId)) {
    router.push('/')
    return
  }
  loadMessages()
})
</script>

<template>
  <div class="p-4">
    <div class="mb-4 flex items-center">
      <button
        class="mr-2 rounded bg-gray-100 px-3 py-1 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        @click="router.back()"
      >
        Back
      </button>
      <h1 class="text-2xl font-bold">
        Chat {{ chatId }}
      </h1>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-gray-500">
      Loading...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-red-500">
      {{ error }}
    </div>

    <!-- Message list -->
    <div v-else class="space-y-4">
      <div
        v-for="message in messages"
        :key="message.id"
        class="rounded-lg bg-gray-100 p-4 dark:bg-gray-800"
      >
        <div class="mb-2 text-sm text-gray-500">
          {{ new Date(message.date).toLocaleString() }}
        </div>
        <div class="whitespace-pre-wrap">
          {{ message.text }}
        </div>
        <!-- Media preview -->
        <div v-if="message.media" class="mt-2">
          <div class="text-sm text-gray-500">
            {{ message.media.type }}
            <span v-if="message.media.fileName">
              - {{ message.media.fileName }}
            </span>
            <span v-if="message.media.fileSize">
              ({{ (message.media.fileSize / 1024 / 1024).toFixed(1) }} MB)
            </span>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="messages.length === 0" class="text-gray-500">
        No messages found
      </div>
    </div>
  </div>
</template>
