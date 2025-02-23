import { ofetch } from 'ofetch'
import { ref } from 'vue'

// API base URL with fallback
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

// Create API client instance with default configuration
export const apiFetch = ofetch.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout
  timeout: 30000,
  // Add retry options
  retry: 0,
})

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

  return {
    loading,
    error,
    request,
  }
}
