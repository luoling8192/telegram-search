<!-- Search page with search functionality -->
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import HighlightText from '../components/HighlightText.vue'
import { useSearch } from '../composables/useSearch'

const route = useRoute()
const router = useRouter()

// Get chat ID from route query
const chatId = route.query.chatId ? Number(route.query.chatId) : undefined

const {
  query,
  isLoading,
  isStreaming,
  results,
  total,
  error,
  currentPage,
  pageSize,
  search: doSearch,
  changePage: handlePageChange,
} = useSearch()

// Handle search with chat ID
async function handleSearch() {
  await doSearch({
    chatId,
  })
}

// Format score for display
function formatScore(score: number): string {
  if (score >= 1)
    return '完全匹配'
  return `相似度 ${(score * 100).toFixed(1)}%`
}

// Format date for display
function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="p-4">
    <div class="mb-4">
      <!-- Header with back button -->
      <div class="mb-4 flex items-center gap-4">
        <button
          v-if="chatId"
          class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          @click="router.back()"
        >
          <div class="i-carbon-arrow-left h-5 w-5 dark:text-white" />
        </button>
        <h1 class="text-2xl font-bold dark:text-gray-100">
          {{ chatId ? 'Search in Chat' : 'Search Messages' }}
        </h1>
      </div>

      <!-- Search input -->
      <div class="mt-4 flex gap-2">
        <input
          v-model="query"
          type="text"
          placeholder="Enter search query..."
          class="flex-1 border rounded-lg px-4 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
          @keyup.enter="handleSearch()"
        >
        <button
          class="rounded-lg bg-blue-500 px-6 py-2 text-white dark:bg-blue-600 hover:bg-blue-600 disabled:opacity-50 dark:hover:bg-blue-700"
          :disabled="isLoading"
          @click="handleSearch()"
        >
          <span v-if="isLoading && !isStreaming">Searching...</span>
          <span v-else-if="isStreaming">Streaming results...</span>
          <span v-else>Search</span>
        </button>
      </div>

      <!-- Error message -->
      <p v-if="error" class="mt-2 text-red-500 dark:text-red-400">
        {{ error.message }}
      </p>
    </div>

    <!-- Results -->
    <div v-if="results.length > 0" class="space-y-4">
      <!-- Results count -->
      <div class="text-sm text-gray-500 dark:text-gray-400">
        Found {{ total }} results
        <span v-if="isStreaming">(searching...)</span>
      </div>

      <div
        v-for="message in results"
        :key="message.id"
        class="cursor-pointer border rounded-lg p-4 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        @click="router.push(`/chat/${message.chatId}#message-${message.id}`)"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <p class="text-gray-600 dark:text-gray-400">
                {{ message.fromName || 'Unknown' }}
              </p>
              <span class="text-sm text-gray-500 dark:text-gray-500">
                {{ formatDate(message.createdAt) }}
              </span>
              <span
                class="rounded px-2 py-0.5 text-xs"
                :class="{
                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100': message.score >= 1,
                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100': message.score < 1,
                }"
              >
                {{ formatScore(message.score) }}
              </span>
            </div>
            <p class="mt-1 whitespace-pre-wrap dark:text-gray-300">
              <HighlightText
                :content="message.content || ''"
                :query="query"
              />
            </p>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="mt-4 flex justify-center">
        <button
          v-for="page in Math.ceil(total / pageSize)"
          :key="page"
          class="mx-1 rounded px-3 py-1"
          :class="{
            'bg-blue-500 text-white dark:bg-blue-600': page === currentPage,
            'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300': page !== currentPage,
          }"
          @click="handlePageChange(page)"
        >
          {{ page }}
        </button>
      </div>
    </div>

    <!-- No results -->
    <div v-else-if="query && !isLoading && !isStreaming" class="mt-8 text-center text-gray-500 dark:text-gray-400">
      No results found
    </div>

    <!-- Loading state -->
    <div v-else-if="isLoading && !results.length" class="mt-8 text-center text-gray-500 dark:text-gray-400">
      Searching...
    </div>
  </div>
</template>
