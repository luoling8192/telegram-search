import type { PaginationParams, PublicChat, PublicFolder, PublicMessage, SearchRequest, SearchResponse } from '@tg-search/server/types'

import { ofetch } from 'ofetch'
import { ref } from 'vue'

// API base URL with fallback
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

/**
 * API error class for handling error responses
 */
export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message)
  }
}

// Create API client instance with default configuration
const apiFetch = ofetch.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout
  timeout: 30000,
  // Add retry options
  retry: 0,
})

// Standalone API functions for direct usage
export const api = {
  /**
   * Search messages in the database
   */
  searchMessages: (params: SearchRequest): Promise<{ success: boolean, data: SearchResponse }> => {
    return apiFetch<{ success: boolean, data: SearchResponse }>('/search', {
      method: 'POST',
      body: params,
    })
  },

  /**
   * Get all chats
   */
  getChats: (): Promise<{ success: boolean, data: PublicChat[] }> => {
    return apiFetch<{ success: boolean, data: PublicChat[] }>('/chats')
  },

  /**
   * Get messages in chat
   */
  getMessages: (chatId: number, params?: PaginationParams): Promise<{
    success: boolean
    data: {
      items: PublicMessage[]
      total: number
      limit: number
      offset: number
    }
  }> => {
    return apiFetch(`/messages/${chatId}`, {
      query: params,
    })
  },
}

/**
 * Vue composable for managing API state and requests
 */
export function useApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const abortController = ref<AbortController | null>(null)

  /**
   * Generic API request wrapper with state management
   */
  const request = async <T>(
    fn: () => Promise<{ success: boolean, data: T }>,
  ): Promise<T> => {
    // Cancel previous request if exists
    if (abortController.value) {
      abortController.value.abort()
    }

    // Create new abort controller
    abortController.value = new AbortController()

    try {
      loading.value = true
      error.value = null

      const response = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        }),
      ])

      if (!response.success) {
        throw new Error('Request failed')
      }

      return response.data
    }
    catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      error.value = message
      console.error('API Error:', message)
      throw e
    }
    finally {
      loading.value = false
      abortController.value = null
    }
  }

  // Composable methods with state management
  return {
    loading,
    error,
    // Methods
    searchMessages: (params: SearchRequest) => request(() => api.searchMessages(params)),
    getChats: () => request(() => api.getChats()),
    getMessages: (chatId: number, params?: PaginationParams) => request(() => api.getMessages(chatId, params)),
  }
}

// Re-export types
export type { PaginationParams, PublicChat, PublicFolder, PublicMessage, SearchRequest, SearchResponse }
