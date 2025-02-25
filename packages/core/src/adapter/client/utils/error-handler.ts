import { useLogger } from '@tg-search/common'

/**
 * Error handling options
 */
export interface ErrorHandlingOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Initial delay in milliseconds before first retry, doubles with each retry */
  initialDelay?: number
  /** Context information for logging */
  context?: string
  /** Custom error message */
  errorMessage?: string
  /** Whether to throw after all retries are exhausted */
  throwAfterRetries?: boolean
}

/**
 * Retry error callback result
 */
export interface RetryResult<T> {
  /** Whether the operation was successful */
  success: boolean
  /** Result data if successful */
  data?: T
  /** Error if operation failed */
  error?: Error
  /** Number of retry attempts made */
  attempts: number
}

/**
 * Centralized error handler for Telegram API related operations
 * Provides retry mechanisms and standardized error reporting
 */
export class ErrorHandler {
  private logger = useLogger()

  // Errors that can be retried
  private retryableErrors = [
    'FLOOD_WAIT_', // Rate limiting
    'CONNECTION_ERROR', // Connection issues
    'TIMEOUT', // Request timeout
    'SERVER_ERROR', // Telegram server error
    'NETWORK_ERROR', // Network connectivity issues
    'AUTH_KEY_UNREGISTERED', // Auth key issues, can sometimes be resolved with retry
    'SESSION_REVOKED', // Session issues that might be resolved by reconnecting
    'TAKEOUT_INIT_DELAY', // Takeout session initialization delay
  ]

  // Errors related to authentication
  private authErrors = [
    'AUTH_KEY_', // Auth key errors
    'PHONE_CODE_', // Phone code errors
    'PHONE_NUMBER_', // Phone number errors
    'PASSWORD_HASH_', // Password errors
    'SESSION_PASSWORD_NEEDED', // 2FA password needed
  ]

  // Permission errors
  private permissionErrors = [
    'CHAT_ADMIN_REQUIRED', // Admin privileges required
    'CHAT_WRITE_FORBIDDEN', // No permission to write
    'USER_PRIVACY_RESTRICTED', // User privacy settings restrict action
    'CHANNEL_PRIVATE', // Cannot access private channel
  ]

  /**
   * Check if an error is retryable
   */
  public isRetryableError(error: Error): boolean {
    const errorMessage = error.message || ''
    return this.retryableErrors.some(code => errorMessage.includes(code))
  }

  /**
   * Check if an error is related to authentication
   */
  public isAuthError(error: Error): boolean {
    const errorMessage = error.message || ''
    return this.authErrors.some(code => errorMessage.includes(code))
  }

  /**
   * Check if an error is related to permissions
   */
  public isPermissionError(error: Error): boolean {
    const errorMessage = error.message || ''
    return this.permissionErrors.some(code => errorMessage.includes(code))
  }

  /**
   * Get wait time from FLOOD_WAIT error
   */
  public getFloodWaitTime(error: Error): number | null {
    const match = error.message.match(/FLOOD_WAIT_(\d+)/)
    if (match && match[1]) {
      return Number.parseInt(match[1], 10) * 1000 // Convert to milliseconds
    }
    return null
  }

  /**
   * Execute an operation with retry mechanism
   */
  public async withRetry<T>(
    operation: () => Promise<T>,
    options: ErrorHandlingOptions = {},
  ): Promise<RetryResult<T>> {
    const maxRetries = options.maxRetries ?? 3
    const initialDelay = options.initialDelay ?? 1000
    const context = options.context ?? 'API操作'
    const throwAfterRetries = options.throwAfterRetries ?? true

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()
        if (attempt > 0) {
          this.logger.withFields({
            context,
            attempts: attempt + 1,
          }).log('操作重试成功')
        }
        return {
          success: true,
          data: result,
          attempts: attempt + 1,
        }
      }
      catch (error: any) {
        lastError = error

        // Check if this is a FLOOD_WAIT error with a specific wait time
        const floodWaitTime = this.getFloodWaitTime(error)

        const isRetryable = this.isRetryableError(error)
        const isLastAttempt = attempt === maxRetries

        if (!isRetryable || isLastAttempt) {
          const errorType = this.getErrorType(error)

          this.logger.withFields({
            context,
            error: error.message,
            errorType,
            attempt: attempt + 1,
            maxRetries,
          }).error(options.errorMessage || '操作失败')

          if (isLastAttempt) {
            this.logger.withFields({
              context,
              error: error.message,
              attempts: attempt + 1,
            }).error('达到最大重试次数，操作失败')
          }

          break
        }

        // Calculate delay (use flood wait time if available)
        const delay = floodWaitTime || initialDelay * (2 ** attempt)

        this.logger.withFields({
          context,
          error: error.message,
          attempt: attempt + 1,
          nextRetryDelay: delay / 1000, // Convert to seconds for logging
          isFloodWait: !!floodWaitTime,
        }).warn('操作失败，准备重试')

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All retries failed
    const result: RetryResult<T> = {
      success: false,
      error: lastError || new Error('未知错误'),
      attempts: maxRetries + 1,
    }

    if (throwAfterRetries && lastError) {
      throw lastError
    }

    return result
  }

  /**
   * Get the error type for categorization and logging
   */
  private getErrorType(error: Error): string {
    const errorMessage = error.message || ''

    if (this.isAuthError(error)) {
      return 'AUTH_ERROR'
    }

    if (this.isPermissionError(error)) {
      return 'PERMISSION_ERROR'
    }

    if (errorMessage.includes('FLOOD_WAIT_')) {
      return 'RATE_LIMIT'
    }

    if (errorMessage.includes('TIMEOUT') || errorMessage.includes('CONNECTION_ERROR')) {
      return 'NETWORK_ERROR'
    }

    if (errorMessage.includes('NOT_FOUND')) {
      return 'NOT_FOUND'
    }

    return 'UNKNOWN_ERROR'
  }

  /**
   * Handle error with appropriate logging but no retry
   */
  public handleError(error: Error, context: string, customMessage?: string): void {
    const errorType = this.getErrorType(error)

    this.logger.withFields({
      context,
      error: error.message,
      errorType,
    }).error(customMessage || '操作失败')
  }
}
