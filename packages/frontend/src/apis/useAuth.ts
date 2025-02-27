import { ref } from 'vue'

import { apiFetch, useApi } from '../composables/api'
import { ErrorCode } from '../types/error'

interface SendCodeOptions {
  apiId?: number
  apiHash?: string
}

interface LoginOptions {
  phoneNumber?: string
  code?: string
  password?: string
  apiId?: number
  apiHash?: string
}

/**
 * Vue composable for managing Telegram authentication state and operations
 */
export function useAuth() {
  const isConnected = ref(false)
  const { loading, error, request } = useApi()

  /**
   * Check Telegram connection status
   */
  async function checkStatus(): Promise<boolean> {
    try {
      const data = await request<{ connected: boolean }>(() =>
        apiFetch('/auth/status'),
      )
      isConnected.value = data.connected
      return isConnected.value
    }
    catch (err) {
      console.error('Failed to check auth status:', err)
      return false
    }
  }

  /**
   * Request sending Telegram verification code
   * @param phoneNumber Phone number with country code
   * @param options Optional API parameters
   */
  async function sendCode(phoneNumber: string, options?: SendCodeOptions): Promise<boolean> {
    try {
      await request(() =>
        apiFetch('/auth/send-code', {
          method: 'POST',
          body: {
            phoneNumber,
            ...(options && {
              apiId: options.apiId,
              apiHash: options.apiHash,
            }),
          },
        }),
      )
      return true
    }
    catch (err) {
      console.error('Failed to send code:', err)
      if (err instanceof Error) {
        throw new TypeError(ErrorCode.UNKNOWN_ERROR)
      }
      return false
    }
  }

  /**
   * Initiate Telegram login
   * @param options Login parameters object
   */
  async function login(options: LoginOptions): Promise<boolean> {
    try {
      await request(() =>
        apiFetch('/auth/login', {
          method: 'POST',
          body: options,
        }),
      )
      isConnected.value = true
      return true
    }
    catch (err) {
      console.error('Failed to login:', err)

      // Check if error is related to 2FA based on error code
      if (err instanceof Error && err.message === ErrorCode.NEED_TWO_FACTOR_CODE) {
        throw new Error(ErrorCode.NEED_TWO_FACTOR_CODE)
      }

      throw new Error(ErrorCode.UNKNOWN_ERROR)
    }
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
    checkStatus,
    sendCode,
    login,
    logout,
  }
}
