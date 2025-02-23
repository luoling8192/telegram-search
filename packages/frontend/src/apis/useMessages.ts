import type { Message } from '@tg-search/core'
import type { PaginationParams, SearchRequest, SearchResponse } from '@tg-search/server/types'

import { ref } from 'vue'

import { apiFetch } from '../composables/api'

/**
 * Vue composable for managing messages state and operations
 */
export function useMessages() {
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)

  /**
   * Search messages with given parameters
   */
  async function searchMessages(params: SearchRequest): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await apiFetch<{ success: boolean, data: SearchResponse }>('/search', {
        method: 'POST',
        body: params,
      })

      if (!response.success) {
        throw new Error('Failed to search messages')
      }

      messages.value = response.data.items
      total.value = response.data.total
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to search messages:', err)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Load messages from a specific chat
   */
  async function loadMessages(chatId: number, params?: PaginationParams): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await apiFetch<{
        success: boolean
        data: {
          items: Message[]
          total: number
          limit: number
          offset: number
        }
      }>(`/messages/${chatId}`, {
        query: params,
      })

      if (!response.success) {
        throw new Error('Failed to fetch messages')
      }

      messages.value = response.data.items
      total.value = response.data.total
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to load messages:', err)
    }
    finally {
      loading.value = false
    }
  }

  return {
    messages,
    loading,
    error,
    total,
    searchMessages,
    loadMessages,
  }
}
