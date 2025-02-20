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
  const logger = useLogger()
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

// Response type definitions
interface BaseResponse {
  success: boolean
  timestamp: string
  code?: string
  message?: string
}

type SuccessResponse<T> = BaseResponse & {
  success: true
  data: T
  pagination?: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

type ErrorResponse = BaseResponse & {
  success: false
  error: string
  code: string
  details?: Record<string, unknown>
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

// Create standardized response
function createResponse<T>(
  data?: T,
  error?: unknown,
  pagination?: SuccessResponse<T>['pagination'],
): ApiResponse<T> {
  if (error) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error',
      code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
    }

    // Add additional error details if available
    if (error instanceof Error && (error as any).details) {
      errorResponse.details = (error as any).details
    }

    return errorResponse
  }

  return {
    success: true,
    data: data as T,
    timestamp: new Date().toISOString(),
    pagination,
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
(async () => {
  const logger = await initServices()
  setupErrorHandlers(logger)

  const app = new Elysia({ adapter: node() })
    .use(cors({
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }))
    .onRequest(({ request }) => {
      // Log request start
      const path = new URL(request.url).pathname
      logger.withFields({
        method: request.method,
        path,
        userAgent: request.headers.get('user-agent'),
      }).debug('Request started')
    })
    .onAfterHandle(({ request }) => {
      // Log successful request
      const path = new URL(request.url).pathname
      logger.withFields({
        method: request.method,
        path,
        status: 200,
        userAgent: request.headers.get('user-agent'),
      }).debug('Request completed')
    })
    .onError(({ request, error, code }) => {
      // Log error request
      const path = new URL(request.url).pathname
      let status = 500

      // Map error codes to status codes
      switch (code) {
        case 'NOT_FOUND':
          status = 404
          break
        case 'VALIDATION':
          status = 400
          break
        case 'PARSE':
          status = 400
          break
      }

      logger.withFields({
        method: request.method,
        path,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: request.headers.get('user-agent'),
      }).error('Request failed')

      // Return error response
      return createResponse(undefined, error)
    })
    .use(chatRoutes)
    .use(searchRoutes)
    .use(messageRoutes)
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
})()
