import type { PaginationParams, PublicChat, PublicFolder, PublicMessage, SearchRequest, SearchResponse } from '@tg-search/server/types'
import { ref } from 'vue'
import { getChats as fetchChats, getFolders as fetchFolders, getMessages as fetchMessages, searchMessages } from '../api'

// API response types
export interface ApiResponse<T> {
  data?: T
  error?: string
}

/**
 * API composable for managing API state and requests
 */
export function useApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Generic API request wrapper
   */
  const request = async <T>(
    fn: () => Promise<T>,
  ): Promise<T> => {
    loading.value = true
    error.value = null

    try {
      return await fn()
    }
    catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      error.value = message
      console.error('API Error:', message)
      throw e
    }
    finally {
      loading.value = false
    }
  }

  // API methods
  const search = (params: SearchRequest) => request(() => searchMessages(params))
  const getChats = () => request(() => fetchChats())
  const getFolders = () => request(() => fetchFolders())
  const getMessages = (chatId: number, params?: PaginationParams) => request(() => fetchMessages(chatId, params))

  return {
    loading,
    error,
    // Methods
    search,
    getChats,
    getFolders,
    getMessages,
  }
}

// Re-export types
export type { PaginationParams, PublicChat, PublicFolder, PublicMessage, SearchRequest, SearchResponse }
