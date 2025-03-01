import { onUnmounted, ref } from 'vue'

import { ConnectionStatus, useWebSocket } from '../composables/useWebSocket'
import { ErrorCode } from '../types/error'

// 消息类型
enum MessageType {
  SEND_CODE = 'SEND_CODE',
  LOGIN = 'LOGIN',
  LOGIN_PROGRESS = 'LOGIN_PROGRESS',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_ERROR = 'LOGIN_ERROR',
  STATUS = 'STATUS',
  LOGOUT = 'LOGOUT',
}

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

interface ProgressData {
  step: 'CODE_SENT' | 'LOGIN_STARTED' | 'CODE_REQUIRED' | 'PASSWORD_REQUIRED'
  success?: boolean
}

/**
 * Vue composable for managing Telegram authentication state and operations through WebSocket
 */
export function useAuthWs() {
  const isConnected = ref(false)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const needsPassword = ref(false)
  const progress = ref<ProgressData | null>(null)

  // 获取WebSocket连接
  const { status, send, addMessageHandler, removeMessageHandler } = useWebSocket('/ws/auth')

  // 处理接收到的WebSocket消息
  const handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'CONNECTED':
          isConnected.value = data.data?.connected || false
          break
        case MessageType.LOGIN_PROGRESS:
          progress.value = data.data
          if (data.data.step === 'PASSWORD_REQUIRED') {
            needsPassword.value = true
          }
          break
        case MessageType.LOGIN_SUCCESS:
          isConnected.value = true
          loading.value = false
          error.value = null
          break
        case MessageType.LOGIN_ERROR:
          loading.value = false
          if (data.error === ErrorCode.NEED_TWO_FACTOR_CODE) {
            needsPassword.value = true
          }
          error.value = new Error(data.message || data.error)
          break
        case MessageType.STATUS:
          isConnected.value = data.data?.connected || false
          loading.value = false
          break
        case MessageType.LOGOUT:
          isConnected.value = false
          loading.value = false
          break
        default:
          console.warn('Unhandled WebSocket message type:', data.type)
      }
    }
    catch (err) {
      console.error('Failed to parse WebSocket message:', err)
    }
  }

  // 注册消息处理程序
  addMessageHandler(handleMessage)

  // 组件卸载时清理
  onUnmounted(() => {
    removeMessageHandler(handleMessage)
  })

  /**
   * Check Telegram connection status
   */
  async function checkStatus(): Promise<boolean> {
    if (status.value !== ConnectionStatus.OPEN) {
      return false
    }

    loading.value = true
    error.value = null

    const messageSent = send({ type: MessageType.STATUS })
    if (!messageSent) {
      loading.value = false
      error.value = new Error('Failed to send status check request')
      return false
    }

    return isConnected.value
  }

  /**
   * Request sending Telegram verification code
   * @param phoneNumber Phone number with country code
   * @param options Optional API parameters
   */
  async function sendCode(phoneNumber: string, options?: SendCodeOptions): Promise<boolean> {
    if (status.value !== ConnectionStatus.OPEN) {
      error.value = new Error('WebSocket is not connected')
      return false
    }

    loading.value = true
    error.value = null
    progress.value = null

    const messageSent = send({
      type: MessageType.SEND_CODE,
      data: {
        phoneNumber,
        ...(options && {
          apiId: options.apiId,
          apiHash: options.apiHash,
        }),
      },
    })

    if (!messageSent) {
      loading.value = false
      error.value = new Error('Failed to send code request')
      return false
    }

    // 返回成功发送请求，实际结果会通过WebSocket回调处理
    return true
  }

  /**
   * Initiate Telegram login
   * @param options Login parameters object
   */
  async function login(options: LoginOptions): Promise<boolean> {
    if (status.value !== ConnectionStatus.OPEN) {
      error.value = new Error('WebSocket is not connected')
      return false
    }

    loading.value = true
    error.value = null

    const messageSent = send({
      type: MessageType.LOGIN,
      data: options,
    })

    if (!messageSent) {
      loading.value = false
      error.value = new Error('Failed to send login request')
      return false
    }

    // 返回成功发送请求，实际登录结果会通过WebSocket回调处理
    return true
  }

  /**
   * Logout from Telegram
   */
  async function logout(): Promise<boolean> {
    if (status.value !== ConnectionStatus.OPEN) {
      error.value = new Error('WebSocket is not connected')
      return false
    }

    loading.value = true
    error.value = null

    const messageSent = send({ type: MessageType.LOGOUT })

    if (!messageSent) {
      loading.value = false
      error.value = new Error('Failed to send logout request')
      return false
    }

    // 返回成功发送请求，实际登出结果会通过WebSocket回调处理
    return true
  }

  /**
   * Reset the login state
   */
  function resetLoginState() {
    needsPassword.value = false
    progress.value = null
    error.value = null
  }

  return {
    isConnected,
    loading,
    error,
    needsPassword,
    progress,
    checkStatus,
    sendCode,
    login,
    logout,
    resetLoginState,
    connectionStatus: status,
  }
}
