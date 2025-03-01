import type { TelegramChat } from '@tg-search/core'

import { ref } from 'vue'

import { apiFetch, useApi } from '../composables/api'

/**
 * Vue composable for managing chats state and operations
 */
export function useChats() {
  const chats = ref<TelegramChat[]>([])
  const total = ref(0)
  const { loading, error, request } = useApi()

  /**
   * Load chats from API
   */
  async function loadChats(): Promise<void> {
    try {
      const data = await request<TelegramChat[]>(() =>
        apiFetch('/chats'),
      )
      chats.value = data
    }
    catch (err) {
      console.error('Failed to load chats:', err)
    }
  }

  return {
    chats,
    loading,
    error,
    total,
    loadChats,
  }
}
