<!-- Chat messages page -->
<script setup lang="ts">
import type { PublicMessage } from '@tg-search/server/types'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MessageBubble from '../../components/MessageBubble.vue'
import { useApi } from '../../composables/api'

// Local message type with highlight support
interface LocalMessage extends PublicMessage {
  highlight?: boolean
}

// Initialize API client and router
const { loading, error, getMessages, getChats } = useApi()
const route = useRoute()
const router = useRouter()
const messages = ref<LocalMessage[]>([])
const total = ref(0)
const chatTitle = ref('')

// Pagination
const pageSize = 50
const currentPage = ref(1)
const totalPages = computed(() => Math.ceil(total.value / pageSize))
const hasMore = computed(() => currentPage.value < totalPages.value)
const loadingMore = ref(false)

// Get chat ID from route
const chatId = Number(route.params.id)

// Message container ref for scroll handling
const messageContainer = ref<HTMLElement>()

// Current user ID (TODO: Get from auth)
const currentUserId = ref(123456789)

// Load chat info
async function loadChatInfo() {
  const chats = await getChats()
  const chat = chats.find(c => c.id === chatId)
  if (chat) {
    chatTitle.value = chat.title
  }
}

// Load messages from chat
async function loadMessages(page = 1, append = false) {
  if (!append) {
    loading.value = true
  }
  else {
    loadingMore.value = true
  }

  try {
    const offset = (page - 1) * pageSize
    const response = await getMessages(chatId, {
      limit: pageSize,
      offset,
    })

    if (response.items) {
      // Get current scroll position
      const scrollPos = messageContainer.value?.scrollHeight || 0
      if (append) {
        // Add older messages to the beginning (since they're in reverse order)
        messages.value.unshift(...response.items)
      }
      else {
        messages.value = response.items.reverse()
      }
      total.value = response.total
      currentPage.value = page

      // Restore scroll position after appending messages
      if (append) {
        await nextTick()
        const newScrollPos = messageContainer.value?.scrollHeight || 0
        messageContainer.value?.scrollTo({
          top: newScrollPos - scrollPos,
          behavior: 'instant',
        })
      }
      else {
        // Scroll to bottom for initial load
        await nextTick()
        messageContainer.value?.scrollTo({
          top: messageContainer.value.scrollHeight,
          behavior: 'instant',
        })
      }
    }
  }
  finally {
    loading.value = false
    loadingMore.value = false
  }
}

// Handle scroll to load more
async function onScroll(e: Event) {
  const target = e.target as HTMLElement
  const { scrollTop } = target
  const threshold = 100 // px from top

  if (
    !loadingMore.value
    && hasMore.value
    && scrollTop < threshold
  ) {
    await loadMessages(currentPage.value + 1, true)
  }
}

// Jump to message by ID
async function jumpToMessage(messageId: number) {
  // Find message in current list
  const targetMessage = messages.value.find(m => m.id === messageId)
  if (targetMessage) {
    // Message is in current list, scroll to it
    const messageElement = document.getElementById(`message-${messageId}`)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight message temporarily
      targetMessage.highlight = true
      setTimeout(() => {
        targetMessage.highlight = false
      }, 2000)
    }
    return
  }

  // Message not in current list, load it
  loading.value = true
  try {
    // Calculate approximate page
    const page = Math.floor(messageId / pageSize)
    const response = await getMessages(chatId, {
      limit: pageSize,
      offset: page * pageSize,
    })

    if (response.items) {
      messages.value = response.items.reverse()
      total.value = response.total
      currentPage.value = page + 1

      await nextTick()
      const messageElement = document.getElementById(`message-${messageId}`)
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Highlight message temporarily
        const targetMessage = messages.value.find(m => m.id === messageId)
        if (targetMessage) {
          targetMessage.highlight = true
          setTimeout(() => {
            targetMessage.highlight = false
          }, 2000)
        }
      }
    }
  }
  finally {
    loading.value = false
  }
}

// Load messages on mount
onMounted(async () => {
  if (Number.isNaN(chatId)) {
    router.push('/')
    return
  }
  await loadChatInfo()
  await loadMessages()
})
</script>

<template>
  <div class="h-screen flex flex-col">
    <!-- Header -->
    <div class="flex items-center border-b bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <button
        class="mr-2 rounded bg-gray-100 px-3 py-1 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        @click="router.back()"
      >
        Back
      </button>
      <h1 class="text-2xl font-bold">
        {{ chatTitle }} <span class="text-gray-500 dark:text-gray-400">({{ chatId }})</span>
      </h1>
    </div>

    <!-- Message list -->
    <div
      ref="messageContainer"
      class="flex-1 overflow-y-auto p-4"
      @scroll="onScroll"
    >
      <!-- Loading state -->
      <div v-if="loading" class="h-full flex items-center justify-center text-gray-500">
        Loading...
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="h-full flex items-center justify-center text-red-500">
        {{ error }}
      </div>

      <!-- Messages -->
      <div v-else class="flex flex-col space-y-4">
        <!-- Load more indicator -->
        <div
          v-if="loadingMore"
          class="flex justify-center py-4 text-sm text-gray-500"
        >
          Loading more messages...
        </div>

        <!-- Message bubbles -->
        <MessageBubble
          v-for="message in messages"
          :key="message.id"
          :id="`message-${message.id}`"
          :message="message"
          :current-user-id="currentUserId"
          @jump-to-message="jumpToMessage"
        />

        <!-- Empty state -->
        <div
          v-if="messages.length === 0"
          class="h-full flex items-center justify-center text-gray-500"
        >
          No messages found
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hide scrollbar for Chrome, Safari and Opera */
.overflow-y-auto::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.overflow-y-auto {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
