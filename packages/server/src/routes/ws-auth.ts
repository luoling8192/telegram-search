import type { ITelegramClientAdapter } from '@tg-search/core'
import type { App } from 'h3'

import { ErrorCode, useLogger } from '@tg-search/common'
import { createRouter, defineEventHandler, defineWebSocketHandler } from 'h3'
import { z } from 'zod'

import { useTelegramClient } from '../services/telegram'
import { createResponse } from '../utils/response'
import { createErrorMessage, createSuccessMessage, parseMessage } from '../utils/ws'

// 创建日志实例
const logger = useLogger()

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

// 消息验证模式
const schemas = {
  sendCode: z.object({
    type: z.literal(MessageType.SEND_CODE),
    data: z.object({
      phoneNumber: z.string(),
      apiId: z.number().optional(),
      apiHash: z.string().optional(),
    }),
  }),
  login: z.object({
    type: z.literal(MessageType.LOGIN),
    data: z.object({
      phoneNumber: z.string(),
      code: z.string(),
      password: z.string().optional(),
      apiId: z.number().optional(),
      apiHash: z.string().optional(),
    }),
  }),
  status: z.object({
    type: z.literal(MessageType.STATUS),
  }),
  logout: z.object({
    type: z.literal(MessageType.LOGOUT),
  }),
}

// 客户端状态管理
interface ClientState {
  client?: ITelegramClientAdapter
  phoneNumber?: string
}

/**
 * 设置WebSocket认证路由
 */
export function setupWsAuthRoutes(app: App) {
  // 创建临时路由处理器，处理之前REST API的请求
  const router = createRouter()

  // 临时处理/auth/status路由
  router.get('/status', defineEventHandler(async () => {
    logger.debug('[/auth/status] 状态检查请求已接收 (临时处理)')

    try {
      const client = await useTelegramClient()
      const connected = await client.isConnected()
      logger.debug(`[/auth/status] 状态检查结果: connected=${connected}`)
      return createResponse({ connected })
    }
    catch (error) {
      logger.error('[/auth/status] 状态检查失败', { error })
      return createResponse({ connected: false })
    }
  }))

  // 将旧的auth路由挂载到/auth路径
  app.use('/auth', router.handler)

  // 存储每个WebSocket连接的状态
  const clientStates = new Map<string, ClientState>()

  // WebSocket处理
  app.use('/ws/auth', defineWebSocketHandler({
    open(peer) {
      logger.debug('[/ws/auth] WebSocket连接已打开', { peerId: peer.id })

      // 初始化连接状态
      clientStates.set(peer.id, {})

      try {
        peer.send(JSON.stringify({
          type: 'CONNECTED',
          data: { connected: false },
        }))
      }
      catch (error) {
        logger.error('[/ws/auth] 发送初始连接消息失败', { error })
      }
    },

    // 消息处理
    async message(peer, message) {
      // 获取此连接的客户端状态
      let clientState = clientStates.get(peer.id)
      if (!clientState) {
        // 如果状态不存在（理论上不应发生），创建一个新状态
        clientState = {}
        clientStates.set(peer.id, clientState)
      }

      try {
        const msgData = parseMessage(message)
        if (!msgData) {
          throw new Error('Invalid message format')
        }

        logger.debug('[/ws/auth] 收到WebSocket消息', { type: msgData.type })

        // 根据消息类型分发处理
        switch (msgData.type) {
          case MessageType.SEND_CODE:
            await handleSendCode(peer, msgData, clientState)
            break
          case MessageType.LOGIN:
            await handleLogin(peer, msgData, clientState)
            break
          case MessageType.STATUS:
            await handleStatus(peer, clientState)
            break
          case MessageType.LOGOUT:
            await handleLogout(peer, clientState)
            break
          default:
            logger.warn('[/ws/auth] 未知消息类型', { type: msgData.type })
            peer.send(JSON.stringify(createErrorMessage(
              MessageType.LOGIN_ERROR,
              'Unknown message type',
            )))
        }
      }
      catch (error) {
        logger.error('[/ws/auth] 处理WebSocket消息失败', { error })
        try {
          peer.send(JSON.stringify(createErrorMessage(
            MessageType.LOGIN_ERROR,
            error instanceof Error ? error.message : 'Unknown error',
          )))
        }
        catch (sendError) {
          logger.error('[/ws/auth] 发送错误消息失败', { error: sendError })
        }
      }
    },

    // 连接关闭
    close(peer) {
      logger.debug('[/ws/auth] WebSocket连接已关闭', { peerId: peer.id })

      // 清理状态
      clientStates.delete(peer.id)
    },
  }))
}

/**
 * 处理发送验证码请求
 */
async function handleSendCode(peer: { id: string, send: (data: string) => void }, message: unknown, state: ClientState) {
  try {
    // 验证消息格式
    const { data } = schemas.sendCode.parse(message)
    const { phoneNumber, apiId, apiHash } = data

    // 获取客户端实例
    const client = await useTelegramClient()
    state.client = client
    state.phoneNumber = phoneNumber

    // 如果提供了API凭据，则更新配置 (使用现有的updateClientConfig函数)
    if (apiId && apiHash) {
      await updateClientConfig(phoneNumber, apiId, apiHash)
      logger.debug('[/ws/auth] API凭据已更新')
    }

    try {
      // 发送验证码
      await client.sendCode()
      logger.debug('[/ws/auth] 验证码已发送成功')

      peer.send(JSON.stringify(createSuccessMessage(
        MessageType.LOGIN_PROGRESS,
        { step: 'CODE_SENT', success: true },
      )))
    }
    catch (error) {
      logger.error('[/ws/auth] 发送验证码失败', { error })
      peer.send(JSON.stringify(createErrorMessage(
        MessageType.LOGIN_ERROR,
        error,
        'Failed to send code',
      )))
    }
  }
  catch (error) {
    logger.error('[/ws/auth] 处理验证码请求失败', { error })
    peer.send(JSON.stringify(createErrorMessage(
      MessageType.LOGIN_ERROR,
      error,
      'Invalid request format',
    )))
  }
}

/**
 * 处理登录请求
 */
async function handleLogin(peer: { id: string, send: (data: string) => void }, message: unknown, state: ClientState) {
  try {
    // 验证消息格式
    const { data } = schemas.login.parse(message)
    const { code, password, phoneNumber, apiId, apiHash } = data

    // 检查是否已经有客户端实例
    if (!state.client) {
      state.client = await useTelegramClient()
    }

    const client = state.client

    // 如果提供了API凭据，则更新配置
    if (apiId && apiHash && phoneNumber) {
      await updateClientConfig(phoneNumber, apiId, apiHash)
      logger.debug('[/ws/auth] API凭据已更新')
    }

    // 统一处理验证码登录，包含2FA密码处理
    logger.debug(`[/ws/auth] 处理登录请求 ${password ? '(包含2FA密码)' : '(仅验证码)'}`)

    // 通知前端登录开始
    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.LOGIN_PROGRESS,
      { step: 'LOGIN_STARTED' },
    )))

    try {
      await client.connect({
        code: async () => {
          // 通知前端需要验证码
          peer.send(JSON.stringify(createSuccessMessage(
            MessageType.LOGIN_PROGRESS,
            { step: 'CODE_REQUIRED' },
          )))
          return code
        },
        password: async () => {
          // 通知前端需要2FA密码
          peer.send(JSON.stringify(createSuccessMessage(
            MessageType.LOGIN_PROGRESS,
            { step: 'PASSWORD_REQUIRED' },
          )))

          if (!password) {
            logger.debug('[/ws/auth] 需要2FA密码但未提供')
            throw new Error(ErrorCode.NEED_TWO_FACTOR_CODE)
          }
          return password
        },
      })

      logger.debug('[/ws/auth] 登录成功')
      peer.send(JSON.stringify(createSuccessMessage(
        MessageType.LOGIN_SUCCESS,
        { success: true },
      )))
    }
    catch (error) {
      if (isTwoFactorError(error)) {
        logger.debug('[/ws/auth] 检测到需要2FA密码')
        peer.send(JSON.stringify(createErrorMessage(
          MessageType.LOGIN_ERROR,
          ErrorCode.NEED_TWO_FACTOR_CODE,
          '需要两步验证密码',
        )))
      }
      else {
        logger.error('[/ws/auth] 登录失败', { error })
        peer.send(JSON.stringify(createErrorMessage(
          MessageType.LOGIN_ERROR,
          error,
          'Login failed',
        )))
      }
    }
  }
  catch (error) {
    logger.error('[/ws/auth] 处理登录请求失败', { error })
    peer.send(JSON.stringify(createErrorMessage(
      MessageType.LOGIN_ERROR,
      error,
      'Invalid request format',
    )))
  }
}

/**
 * 处理状态检查请求
 */
async function handleStatus(peer: { id: string, send: (data: string) => void }, state: ClientState) {
  try {
    // 如果还没有客户端实例，创建一个
    if (!state.client) {
      state.client = await useTelegramClient()
    }

    const client = state.client

    // 如果未连接，尝试连接（不会执行登录）
    let connected = false
    if (!await client.isConnected()) {
      try {
        await client.connect()
        connected = await client.isConnected()
      }
      catch (connError) {
        // 连接失败但不中断流程，返回未连接状态
        logger.debug('[/ws/auth] 尝试连接失败，返回未连接状态', { error: connError })
      }
    }
    else {
      connected = true
    }

    logger.debug(`[/ws/auth] 状态检查结果: connected=${connected}`)
    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.STATUS,
      { connected },
    )))
  }
  catch (error) {
    logger.error('[/ws/auth] 状态检查失败', { error })
    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.STATUS,
      { connected: false },
    )))
  }
}

/**
 * 处理登出请求
 */
async function handleLogout(peer: { id: string, send: (data: string) => void }, state: ClientState) {
  try {
    // 如果还没有客户端实例，创建一个
    if (!state.client) {
      state.client = await useTelegramClient()
    }

    const client = state.client

    if (await client.isConnected()) {
      await client.logout()
      logger.debug('[/ws/auth] 已成功登出并清除会话')
    }
    else {
      logger.debug('[/ws/auth] 客户端未连接，无需登出')
    }

    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.LOGOUT,
      { success: true },
    )))
  }
  catch (error) {
    logger.error('[/ws/auth] 登出失败', { error })
    peer.send(JSON.stringify(createErrorMessage(
      MessageType.LOGIN_ERROR,
      error,
      'Logout failed',
    )))
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
async function updateClientConfig(phoneNumber: string, apiId: number, apiHash: string): Promise<void> {
  const { getConfig, updateConfig } = await import('@tg-search/common')
  const config = getConfig()
  config.api.telegram = {
    ...config.api.telegram,
    apiId: apiId.toString(),
    apiHash,
    phoneNumber,
  }
  updateConfig(config)
}
