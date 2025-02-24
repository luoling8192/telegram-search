import { ofetch } from 'ofetch'
import { ref } from 'vue'

import { API_BASE, API_CONFIG } from '../constants'

// Create API client instance with default configuration
export const apiFetch = ofetch.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  ...API_CONFIG,
})

/**
 * Vue composable for managing API state and requests
 */
export function useApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 使用 Map 存储所有请求的控制器
  const controllers = new Map<string, AbortController>()

  /**
   * Generic API request wrapper with state management
   */
  const request = async <T>(
    fn: () => Promise<{ success: boolean, data: T }>,
    options?: {
      key?: string // 唯一标识用于取消
      timeout?: number
    },
  ): Promise<T> => {
    const controller = new AbortController()
    const requestKey = options?.key || Date.now().toString()

    // 存储控制器
    controllers.set(requestKey, controller)

    try {
      loading.value = true
      error.value = null

      const response = await Promise.race([
        fn().then(r => r).catch((error) => {
          if (error.name === 'AbortError')
            throw error
          return { success: false, data: null }
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), options?.timeout || 30000)
        }),
      ])

      if (!response.success) {
        throw new Error('Request failed')
      }

      // Handle null case to satisfy TypeScript type check
      if (response.data === null) {
        throw new Error('Response data is null')
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
      controllers.delete(requestKey)
    }
  }

  // 添加取消方法
  const cancelRequest = (key: string) => {
    controllers.get(key)?.abort()
    controllers.delete(key)
  }

  return {
    loading,
    error,
    request,
    cancelRequest,
  }
}
