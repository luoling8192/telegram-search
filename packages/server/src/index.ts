import type {
  App,
  H3Event,
} from 'h3'

import process from 'node:process'
import { initConfig, initDB, initLogger, useLogger } from '@tg-search/common'
import {
  createApp,
  eventHandler,
  getRequestHeader,
  setResponseHeaders,
  toNodeListener,
} from 'h3'
import { listen } from 'listhen'

import { setupAuthRoutes } from './routes/auth'
import { setupChatRoutes } from './routes/chat'
import { setupCommandRoutes } from './routes/commands'
import { setupConfigRoutes } from './routes/config'
import { setupMessageRoutes } from './routes/message'
import { setupSearchRoutes } from './routes/search'
import { createErrorResponse } from './utils/response'

export * from './types'

// Core initialization
async function initCore(): Promise<ReturnType<typeof useLogger>> {
  initLogger()
  const logger = useLogger()
  initConfig()

  try {
    await initDB()
    logger.debug('Database initialized successfully')
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

/**
 * Setup all routes for the application
 */
function setupRoutes(app: App) {
  setupAuthRoutes(app)
  setupChatRoutes(app)
  setupCommandRoutes(app)
  setupConfigRoutes(app)
  setupMessageRoutes(app)
  setupSearchRoutes(app)
}

// Server configuration
function configureServer(logger: ReturnType<typeof useLogger>) {
  const app = createApp()

  // CORS middleware
  app.use(eventHandler((event: H3Event) => {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': 'http://localhost:3333',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With',
    })

    if (event.method === 'OPTIONS') {
      setResponseHeaders(event, {
        'Access-Control-Max-Age': '86400',
      })
      return null
    }
  }))

  // Request logging middleware
  app.use(eventHandler(async (event: H3Event) => {
    const path = event.path
    const method = event.method
    const userAgent = getRequestHeader(event, 'user-agent')

    logger.withFields({
      method,
      path,
      userAgent,
    }).debug('Request started')

    try {
      // Pass the event to the next handler

    }
    catch (error: unknown) {
      const status = error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500

      logger.withFields({
        method,
        path,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent,
      }).error('Request failed')

      return createErrorResponse(error)
    }
  }))

  // Setup routes
  setupRoutes(app)

  return app
}

// Main application bootstrap
async function bootstrap() {
  const logger = await initCore()
  setupErrorHandlers(logger)

  const app = configureServer(logger)
  const listener = toNodeListener(app)

  await listen(listener, {
    port: 3000,
    showURL: true,
  })

  const shutdown = () => process.exit(0)
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return app
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
