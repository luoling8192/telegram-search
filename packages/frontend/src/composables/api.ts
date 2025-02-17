import { ref } from 'vue'

// API base URL
const API_BASE = 'http://localhost:3000/api'

// API response types
export interface Chat {
  id: number
  title: string
  folder_id?: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

// API client
export function useApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Sleep helper
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  // Generic fetch wrapper with retry
  const fetchApi = async <T>(
    endpoint: string,
    options: RequestInit = {},
    retries = MAX_RETRIES,
  ): Promise<ApiResponse<T>> => {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'

      // Retry on network errors
      if (retries > 0 && (e instanceof TypeError || message.includes('Failed to fetch'))) {
        console.log(`Retrying... ${retries} attempts left`)
        await sleep(RETRY_DELAY)
        return fetchApi(endpoint, options, retries - 1)
      }

      error.value = message
      return { error: message }
    }
    finally {
      loading.value = false
    }
  }

  // Chat API methods
  const getChats = () => fetchApi<{ chats: Chat[] }>('/chat')
  const getChatsByFolder = (folderId: number) =>
    fetchApi<{ chats: Chat[] }>(`/chat/folder/${folderId}`)

  return {
    loading,
    error,
    // Chat methods
    getChats,
    getChatsByFolder,
  }
}
