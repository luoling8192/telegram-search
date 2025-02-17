<!-- Chat list page -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { type Chat, useApi } from '../composables/api'

// Initialize API client and router
const { loading, getChats } = useApi()
const router = useRouter()
const chats = ref<Chat[]>([])

// Load chats from API
async function loadChats() {
  const response = await getChats()
  if (response.data?.chats) {
    chats.value = response.data.chats
  }
  else {
    console.warn('No chats data in response')
  }
}

// Navigate to folder view
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
        <p
          v-if="chat.id"
          class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          View chat {{ chat.id }}
        </p>
      </div>
    </div>
  </div>
</template>
