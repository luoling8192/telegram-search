<!-- Chat list page -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/api'
import type { PublicChat } from '@tg-search/server/types'

// Initialize API client and router
const { loading, getChats } = useApi()
const router = useRouter()
const chats = ref<PublicChat[]>([])

// Load chats from API
async function loadChats() {
  chats.value = await getChats()
}

// Navigate to chat view
function goToChat(chatId: number) {
  router.push(`/chat/${chatId}`)
}

// Load chats on component mount
onMounted(() => {
  loadChats()
})
</script>

<template>
  <div class="p-4">
    <h1 class="mb-4 text-2xl font-bold">
      Chats
    </h1>

    <!-- Loading state -->
    <div v-if="loading" class="text-gray-500">
      Loading...
    </div>

    <!-- Chat list -->
    <div v-else class="space-y-2">
      <div
        v-for="chat in chats"
        :key="chat.id"
        class="cursor-pointer rounded-lg bg-gray-100 p-4 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        @click="goToChat(chat.id)"
      >
        <h2 class="text-lg font-semibold">
          {{ chat.title }}
        </h2>
        <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
          <span>{{ chat.type }}</span>
          <span>{{ chat.messageCount }} messages</span>
          <span v-if="chat.lastMessageDate">
            Last message: {{ new Date(chat.lastMessageDate).toLocaleString() }}
          </span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="chats.length === 0" class="text-gray-500">
        No chats found
      </div>
    </div>
  </div>
</template>
