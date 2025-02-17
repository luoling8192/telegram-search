<!-- Folder chats page -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { type Chat, useApi } from '../../composables/api'

// Initialize API client and router
const api = useApi()
const route = useRoute()
const router = useRouter()
const chats = ref<Chat[]>([])

// Get folder ID from route
const folderId = Number(route.params.id)

// Load chats in folder
async function loadChats() {
  const response = await api.getChatsByFolder(folderId)
  if (response.data) {
    chats.value = response.data.chats
  }
}

// Load chats on mount
onMounted(() => {
  if (Number.isNaN(folderId)) {
    router.push('/')
    return
  }
  loadChats()
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
        Folder {{ folderId }}
      </h1>
    </div>

    <!-- Loading state -->
    <div v-if="api.loading" class="text-gray-500">
      Loading...
    </div>

    <!-- Error state -->
    <div v-else-if="api.error" class="text-red-500">
      {{ api.error }}
    </div>

    <!-- Chat list -->
    <div v-else class="space-y-2">
      <div
        v-for="chat in chats"
        :key="chat.id"
        class="rounded-lg bg-gray-100 p-4 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <h2 class="text-lg font-semibold">
          {{ chat.title }}
        </h2>
      </div>

      <!-- Empty state -->
      <div v-if="chats.length === 0" class="text-gray-500">
        No chats found in this folder
      </div>
    </div>
  </div>
</template>
