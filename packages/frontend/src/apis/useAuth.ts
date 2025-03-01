import type { SuccessResponse } from '@tg-search/server'

import { ref } from 'vue'

import { apiFetch, useApi } from '../composables/api'

/**
 * Vue composable for managing Telegram authentication state and operations
 */
export function useAuth() {
  const isConnected = ref(false)
  const { loading, error, request } = useApi()

  async function checkStatus(): Promise<boolean> {
    const response = await apiFetch<SuccessResponse<{ connected: boolean }>>('/auth/status', {
      method: 'GET',
    })

    isConnected.value = response.data.connected
    return response.data.connected
  }

  /**
   * Logout from Telegram
   */
  async function logout(): Promise<boolean> {
    try {
      await request(() =>
        apiFetch('/auth/logout', {
          method: 'POST',
        }),
      )
      isConnected.value = false
      return true
    }
    catch (err) {
      console.error('Failed to logout:', err)
      return false
    }
  }

  return {
    isConnected,
    loading,
    error,
    logout,
    checkStatus,
  }
}
