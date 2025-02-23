import type { ConnectOptions } from '@tg-search/core'
import type { App, H3Event } from 'h3'

import { createRouter, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'

import { useTelegramClient } from '../services/telegram'
import { createResponse } from '../utils/response'

// Auth validation schema
const loginSchema = z.object({
  code: z.string().optional(),
  password: z.string().optional(),
})

/**
 * Setup auth routes
 */
export function setupAuthRoutes(app: App) {
  const router = createRouter()

  // Login route
  router.post('/login', defineEventHandler(async (event: H3Event) => {
    try {
      const body = await readBody(event)
      const validatedBody = loginSchema.parse(body)

      const client = await useTelegramClient()
      const options: ConnectOptions = {
        code: async () => {
          if (!validatedBody.code)
            throw new Error('验证码不能为空')
          return validatedBody.code
        },
        password: async () => {
          if (!validatedBody.password)
            throw new Error('密码不能为空')
          return validatedBody.password
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
  }))

  // Status route
  router.get('/status', defineEventHandler(async () => {
    try {
      const client = await useTelegramClient()
      return createResponse({ connected: await client.isConnected() })
    }
    catch {
      return createResponse({ connected: false })
    }
  }))

  // Mount routes
  app.use('/auth', router.handler)
}
