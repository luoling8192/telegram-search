import type { Chat, Message } from '@tg-search/core'
import type { PaginationParams } from '@tg-search/server/types'

import { ref } from 'vue'

import { apiFetch } from '../composables/api'

/**
 * Vue composable for managing chats state and operations
 */
export function useChats() {
  const chats = ref<Chat[]>([])
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)

  /**
   * Load chats from API
   */
  async function loadChats(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await apiFetch<{ success: boolean, data: Chat[] }>('/chats')
      if (!response.success) {
        throw new Error('Failed to fetch chats')
      }
      chats.value = response.data
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to load chats:', err)
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
    chats,
    messages,
    loading,
    error,
    total,
    loadChats,
    loadMessages,
  }
}
