import { ofetch } from 'ofetch'
import { ref } from 'vue'

// API base URL
const API_BASE = 'http://localhost:3000/api'

// API response types
export interface Chat {
  id: number
  title: string
  folder_id?: number
}

export interface ChatListResponse {
  chats: Chat[]
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

// API client
export function useApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Create ofetch instance with base configuration
  const apiFetch = ofetch.create({
    baseURL: API_BASE,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    // Handle response errors
    onResponseError: ({ response }) => {
      throw new Error(response._data?.error || `HTTP error! status: ${response.status}`)
    },
    // Handle request errors
    onRequestError: ({ error: err }) => {
      throw new Error(err.message || 'Network error')
    },
  })

  // Generic fetch wrapper
  const fetchApi = async <T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> => {
    loading.value = true
    error.value = null

    try {
      const response = await apiFetch(endpoint, {
        ...options,
      })
      console.warn('API Response:', response)
      // Ensure we're returning the response in the correct format
      if (typeof response === 'object' && response !== null) {
        return { data: response as T }
      }
      else {
        console.warn('Unexpected response format:', response)
        return { error: 'Invalid response format' }
      }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      error.value = message
      console.error('API Error:', message)
      return { error: message }
    }
    finally {
      loading.value = false
    }
  }

  // Chat API methods
  const getChats = () => fetchApi<ChatListResponse>('/chat')
  const getChatsByFolder = (folderId: number) =>
    fetchApi<ChatListResponse>(`/chat/folder/${folderId}`)

  return {
    loading,
    error,
    // Chat methods
    getChats,
    getChatsByFolder,
  }
}
