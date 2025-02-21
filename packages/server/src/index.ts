import process from 'node:process'
import { cors } from '@elysiajs/cors'
import { node } from '@elysiajs/node'
import { initConfig, initDB, initLogger, useLogger } from '@tg-search/common'
import { Elysia } from 'elysia'

import { authRoutes } from './routes/auth'
import { chatRoutes } from './routes/chat'
import { commandRoutes } from './routes/commands'
import { configRoutes } from './routes/config'
import { messageRoutes } from './routes/message'
import { searchRoutes } from './routes/search'
import { getTelegramClient } from './services/telegram'
import { createResponse } from './utils/response'

// Core initialization
async function initCore(): Promise<ReturnType<typeof useLogger>> {
  initLogger()
  const logger = useLogger()
  initConfig()

  try {
    await initDB()
    logger.debug('Database initialized successfully')

    const client = await getTelegramClient()
    try {
      await client.connect()
      logger.debug('Telegram client connected successfully')
    }
    catch (error) {
      logger.withError(error).warn('Failed to connect to Telegram, authentication required')
    }
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize services')
    process.exit(1)
  }

  return logger
}

// Error handling setup
function setupErrorHandlers(logger: ReturnType<typeof useLogger>): void {
  const handleFatalError = (error: unknown, type: string) => {
    logger.withError(error).error(type)
    process.exit(1)
  }

  process.on('uncaughtException', error => handleFatalError(error, 'Uncaught exception'))
  process.on('unhandledRejection', error => handleFatalError(error, 'Unhandled rejection'))
}

// Server configuration
function configureServer(logger: ReturnType<typeof useLogger>): Elysia {
  return new Elysia({ adapter: node() })
    .use(cors({
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }))
    .onRequest(({ request }) => {
      const path = new URL(request.url).pathname
      logger.withFields({
        method: request.method,
        path,
        userAgent: request.headers.get('user-agent'),
      }).debug('Request started')
    })
    .onAfterHandle(({ request }) => {
      const path = new URL(request.url).pathname
      logger.withFields({
        method: request.method,
        path,
        status: 200,
        userAgent: request.headers.get('user-agent'),
      }).debug('Request completed')
    })
    .onError(({ request, error, code }) => {
      const path = new URL(request.url).pathname
      const status = getErrorStatus(code as string)

      logger.withFields({
        method: request.method,
        path,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: request.headers.get('user-agent'),
      }).error('Request failed')

      return createResponse(undefined, error)
    })
    .use(authRoutes)
    .use(chatRoutes)
    .use(searchRoutes)
    .use(messageRoutes)
    .use(configRoutes)
    .use(commandRoutes)
}

// Helper function to map error codes to status codes
function getErrorStatus(code: string): number {
  const statusMap: Record<string, number> = {
    NOT_FOUND: 404,
    VALIDATION: 400,
    PARSE: 400,
  }
  return statusMap[code] || 500
}

// Main application bootstrap
(async () => {
  const logger = await initCore()
  setupErrorHandlers(logger)

  const app = configureServer(logger)
    .listen(3000, () => {
      logger.debug('Server listening on http://localhost:3000')
    })

  const shutdown = () => process.exit(0)
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return app
})()
