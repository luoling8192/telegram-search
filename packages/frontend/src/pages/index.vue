<!-- Chat list page -->
<script setup lang="ts">
import type { PublicChat } from '@tg-search/server/types'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/api'

// Initialize API client and router
const { loading, getChats } = useApi()
const router = useRouter()
const chats = ref<PublicChat[]>([])

// Computed properties for filtered and categorized chats
const nonEmptyChats = computed(() => chats.value.filter(chat => chat.messageCount > 0))

const privateChats = computed(() => nonEmptyChats.value.filter(chat => chat.type === 'user'))
const groupChats = computed(() => nonEmptyChats.value.filter(chat => chat.type === 'group'))
const channelChats = computed(() => nonEmptyChats.value.filter(chat => chat.type === 'channel'))

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
    <div v-else class="space-y-6">
      <!-- Private Chats -->
      <div v-if="privateChats.length > 0">
        <h2 class="mb-2 text-xl font-semibold">
          Private Chats
        </h2>
        <div class="space-y-2">
          <div
            v-for="chat in privateChats"
            :key="chat.id"
            class="cursor-pointer rounded-lg bg-gray-100 p-4 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            @click="goToChat(chat.id)"
          >
            <h2 class="text-left text-lg font-semibold">
              {{ chat.title }}
            </h2>
            <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span>{{ chat.messageCount }} messages</span>
              <span v-if="chat.lastMessageDate">
                Last message: {{ new Date(chat.lastMessageDate).toLocaleString() }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Group Chats -->
      <div v-if="groupChats.length > 0">
        <h2 class="mb-2 text-xl font-semibold">
          Group Chats
        </h2>
        <div class="space-y-2">
          <div
            v-for="chat in groupChats"
            :key="chat.id"
            class="cursor-pointer rounded-lg bg-gray-100 p-4 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            @click="goToChat(chat.id)"
          >
            <h2 class="text-left text-lg font-semibold">
              {{ chat.title }}
            </h2>
            <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span>{{ chat.messageCount }} messages</span>
              <span v-if="chat.lastMessageDate">
                Last message: {{ new Date(chat.lastMessageDate).toLocaleString() }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Channel Chats -->
      <div v-if="channelChats.length > 0">
        <h2 class="mb-2 text-xl font-semibold">
          Channels
        </h2>
        <div class="space-y-2">
          <div
            v-for="chat in channelChats"
            :key="chat.id"
            class="cursor-pointer rounded-lg bg-gray-100 p-4 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            @click="goToChat(chat.id)"
          >
            <h2 class="text-left text-lg font-semibold">
              {{ chat.title }}
            </h2>
            <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span>{{ chat.messageCount }} messages</span>
              <span v-if="chat.lastMessageDate">
                Last message: {{ new Date(chat.lastMessageDate).toLocaleString() }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="nonEmptyChats.length === 0" class="text-gray-500">
        No chats found
      </div>
    </div>
  </div>
</template>
