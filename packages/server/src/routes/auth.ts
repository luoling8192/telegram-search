import type { App, H3Event } from 'h3'
import type { AuthResponse, SendCodeResponse } from '../types'

import { ErrorCode, getConfig, updateConfig, useLogger } from '@tg-search/common'
import { createRouter, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'

import { useTelegramClient } from '../services/telegram'
import { createErrorResponse, createResponse } from '../utils/response'

// 创建日志实例
const logger = useLogger()

/**
 * 请求验证模式定义
 */
const schemas = {
  // 发送验证码请求模式
  sendCode: z.object({
    phoneNumber: z.string(),
    apiId: z.number().optional(),
    apiHash: z.string().optional(),
  }),

  // 登录请求模式
  login: z.object({
    phoneNumber: z.string(),
    code: z.string(),
    password: z.string().optional(),
    apiId: z.number().optional(),
    apiHash: z.string().optional(),
  }),
}

/**
 * 设置认证相关路由
 */
export function setupAuthRoutes(app: App) {
  const router = createRouter()

  // 路由注册
  router.post('/send-code', defineEventHandler(handleSendCode))
  router.post('/login', defineEventHandler(handleLogin))
  router.get('/status', defineEventHandler(handleStatus))
  router.post('/logout', defineEventHandler(handleLogout))

  // 将路由处理器挂载到 /auth 路径
  app.use('/auth', router.handler)
}

/**
 * 发送验证码处理
 */
async function handleSendCode(event: H3Event) {
  logger.debug('[/auth/send-code] 验证码请求已接收')

  try {
    // 验证请求数据
    const body = await readBody(event)
    const validatedBody = schemas.sendCode.parse(body)
    const { phoneNumber, apiId, apiHash } = validatedBody

    // 获取客户端实例
    const client = await useTelegramClient()

    // 如果提供了API凭据，则更新配置
    if (apiId && apiHash) {
      updateClientConfig(phoneNumber, apiId, apiHash)
      logger.debug('[/auth/send-code] API凭据已更新')
    }

    try {
      // 发送验证码
      await client.sendCode()
      logger.debug('[/auth/send-code] 验证码已发送成功')

      return createResponse<SendCodeResponse>({ success: true })
    }
    catch (error) {
      logger.error('[/auth/send-code] 发送验证码失败', { error })
      return createErrorResponse(error, '发送验证码失败')
    }
  }
  catch (error) {
    logger.error('[/auth/send-code] 处理验证码请求失败', { error })
    return createErrorResponse(error, '发送验证码失败')
  }
}

/**
 * 登录处理
 */
async function handleLogin(event: H3Event) {
  logger.debug('[/auth/login] 登录请求已接收')

  try {
    // 验证和解析请求数据
    const body = await readBody(event)
    const { code, password, phoneNumber, apiId, apiHash } = body

    // 基本验证
    if (!code) {
      logger.warn('[/auth/login] 登录请求缺少验证码')
      return createErrorResponse(ErrorCode.INVALID_INPUT, '缺少验证码')
    }

    // 获取客户端实例
    const client = await useTelegramClient()

    // 如果提供了API凭据，则更新配置
    if (apiId && apiHash && phoneNumber) {
      updateClientConfig(phoneNumber, apiId, apiHash)
      logger.debug('[/auth/login] API凭据已更新')
    }

    // 统一处理验证码登录，可能包含2FA密码
    logger.debug(`[/auth/login] 处理登录请求 ${password ? '(包含2FA密码)' : '(仅验证码)'}`)

    try {
      await client.connect({
        code: async () => code,
        password: async () => {
          if (!password) {
            logger.debug('[/auth/login] 需要2FA密码但未提供')
            throw new Error(ErrorCode.NEED_TWO_FACTOR_CODE)
          }
          return password
        },
      })

      logger.debug('[/auth/login] 登录成功')
      return createResponse<AuthResponse>({ success: true })
    }
    catch (error) {
      if (isTwoFactorError(error)) {
        logger.debug('[/auth/login] 检测到需要2FA密码')
        return createErrorResponse(ErrorCode.NEED_TWO_FACTOR_CODE, '需要两步验证密码')
      }

      logger.error('[/auth/login] 登录失败', { error })
      throw error
    }
  }
  catch (error) {
    logger.error('[/auth/login] 登录失败', { error })
    return createErrorResponse(error, '登录失败')
  }
}

/**
 * 状态检查处理
 */
async function handleStatus() {
  logger.debug('[/auth/status] 状态检查请求已接收')

  try {
    const client = await useTelegramClient()

    // 如果未连接，尝试连接（不会执行登录）
    if (!await client.isConnected()) {
      try {
        await client.connect()
      }
      catch (connError) {
        // 连接失败但不中断流程，返回未连接状态
        logger.debug('[/auth/status] 尝试连接失败，返回未连接状态', { error: connError })
      }
    }

    const connected = await client.isConnected()
    logger.debug(`[/auth/status] 状态检查结果: connected=${connected}`)
    return createResponse({ connected })
  }
  catch (error) {
    logger.error('[/auth/status] 状态检查失败', { error })
    return createResponse({ connected: false })
  }
}

/**
 * 登出处理
 */
async function handleLogout() {
  logger.debug('[/auth/logout] 登出请求已接收')

  try {
    const client = await useTelegramClient()

    if (await client.isConnected()) {
      await client.logout()
      logger.debug('[/auth/logout] 已成功登出并清除会话')
    }
    else {
      logger.debug('[/auth/logout] 客户端未连接，无需登出')
    }

    return createResponse<AuthResponse>({ success: true })
  }
  catch (error) {
    logger.error('[/auth/logout] 登出失败', { error })
    return createErrorResponse(error, '登出失败')
  }
}

/**
 * 判断是否为两步验证错误
 */
function isTwoFactorError(error: unknown): boolean {
  return error instanceof Error && error.message === ErrorCode.NEED_TWO_FACTOR_CODE
}

/**
 * 更新客户端API配置
 */
function updateClientConfig(phoneNumber: string, apiId: number, apiHash: string): void {
  const config = getConfig()
  config.api.telegram = {
    ...config.api.telegram,
    apiId: apiId.toString(),
    apiHash,
    phoneNumber,
  }
  updateConfig(config)
}
