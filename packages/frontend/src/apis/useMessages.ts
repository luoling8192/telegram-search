import type { TelegramMessage } from '@tg-search/core'
import type { PaginationParams } from '@tg-search/server/types'

import { ref } from 'vue'

import { useApi } from '../composables/api'

/**
 * Vue composable for managing messages state and operations
 */
export function useMessages() {
  const messages = ref<TelegramMessage[]>([])
  const total = ref(0)
  const { loading, error, request } = useApi()

  /**
   * Load messages from a specific chat
   */
  async function loadMessages(chatId: number, params?: PaginationParams): Promise<void> {
    try {
      const data = await request<{
        items: TelegramMessage[]
        total: number
        limit: number
        offset: number
      }>(async () => {
        const response = await fetch(`/messages/${chatId}${params ? `?${new URLSearchParams(params as any)}` : ''}`)
        const json = await response.json()
        return {
          success: response.ok,
          data: json.data,
        }
      })

      messages.value = data.items
      total.value = data.total
    }
    catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  return {
    messages,
    loading,
    error,
    total,
    loadMessages,
  }
}
