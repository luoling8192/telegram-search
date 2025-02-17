import process from 'node:process'
import { cors } from '@elysiajs/cors'
import { node } from '@elysiajs/node'
import { initConfig, initDB, initLogger, useLogger } from '@tg-search/common'
import { Elysia } from 'elysia'

import { chatRoutes } from './routes/chat'
import { messageRoutes } from './routes/message'
import { searchRoutes } from './routes/search'

// Initialize core services
async function initServices() {
  initLogger()
  const logger = useLogger('server')
  initConfig()

  try {
    initDB()
    logger.debug('Database initialized successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize database')
    process.exit(1)
  }

  return logger
}

// Create standardized response
function createResponse<T>(data?: T, error?: unknown) {
  if (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error',
      code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
    }
  }

  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  }
}

// Setup process error handlers
function setupErrorHandlers(logger: ReturnType<typeof useLogger>) {
  const handleFatalError = (error: unknown, type: string) => {
    logger.withError(error).error(type)
    process.exit(1)
  }

  process.on('uncaughtException', error => handleFatalError(error, 'Uncaught exception'))
  process.on('unhandledRejection', error => handleFatalError(error, 'Unhandled rejection'))
}

// Main server setup
async function setupServer() {
  const logger = await initServices()
  setupErrorHandlers(logger)

  const app = new Elysia({ adapter: node() })
    .use(cors({
      origin: 'http://localhost:3333',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }))
    .use(chatRoutes)
    .use(searchRoutes)
    .use(messageRoutes)
    .onError(({ error }) => {
      logger.withError(error).error('Application error')
      return createResponse(undefined, error)
    })
    .listen(3000, () => {
      logger.debug('Server listening on http://localhost:3000')
    })

  // Graceful shutdown handler
  const shutdown = () => {
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return app
}

// Start server
(async () => {
  await setupServer()
})()
