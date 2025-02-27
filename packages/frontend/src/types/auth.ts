/**
 * Telegram 登录请求参数
 */
export interface LoginRequest {
  code?: string
  password?: string
}

/**
 * Telegram 登录响应
 */
export interface LoginResponse {
  success: boolean
}

/**
 * Telegram 连接状态响应
 */
export interface StatusResponse {
  connected: boolean
}
