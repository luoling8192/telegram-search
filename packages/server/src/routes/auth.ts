import type { ConnectOptions } from '@tg-search/core'

import { useLogger } from '@tg-search/common'
import { Elysia, t } from 'elysia'

import { getTelegramClient } from '../services/telegram'
import { createResponse } from '../utils/response'

const logger = useLogger()

// Auth routes
export const authRoutes = new Elysia({ prefix: '/auth' })
  .onError(({ code, error }) => {
    logger.withError(error).error(`Error handling request: ${code}`)
    return createResponse(undefined, error)
  })
  .post('/login', async ({ body }) => {
    try {
      const client = await getTelegramClient()
      const options: ConnectOptions = {
        code: async () => {
          if (!body.code)
            throw new Error('验证码不能为空')
          return body.code
        },
        password: async () => {
          if (!body.password)
            throw new Error('密码不能为空')
          return body.password
        },
      }
      await client.connect(options)
      return createResponse({ success: true })
    }
    catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('PHONE_CODE_INVALID')) {
          return createResponse(undefined, new Error('验证码无效'))
        }
        if (error.message.includes('PASSWORD_HASH_INVALID')) {
          return createResponse(undefined, new Error('两步验证密码错误'))
        }
        if (error.message.includes('already connected')) {
          return createResponse({ success: true })
        }
      }
      throw error
    }
  }, {
    body: t.Object({
      code: t.Optional(t.String()),
      password: t.Optional(t.String()),
    }),
  })
  .get('/status', async () => {
    try {
      const client = await getTelegramClient()
      const isConnected = await client.connect().then(() => true).catch(() => false)
      return createResponse({ connected: isConnected })
    }
    catch {
      return createResponse({ connected: false })
    }
  })
