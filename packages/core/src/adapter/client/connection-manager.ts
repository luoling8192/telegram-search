import type { ConnectOptions } from '../../types'
import type { SessionManager } from './session-manager'

import { useLogger } from '@tg-search/common'
import { TelegramClient } from 'telegram'

import { ErrorHandler } from './utils/error-handler'

/**
 * Manager for Telegram client connection
 * Handles connection establishment, authentication and session management
 */
export class ConnectionManager {
  private client: TelegramClient
  private sessionManager: SessionManager
  private logger = useLogger()
  private errorHandler = new ErrorHandler()
  private apiId: number
  private apiHash: string
  private phoneNumber: string

  constructor(sessionManager: SessionManager, apiId: number, apiHash: string, phoneNumber: string) {
    this.sessionManager = sessionManager
    this.apiId = apiId
    this.apiHash = apiHash
    this.phoneNumber = phoneNumber

    // Create client with session
    this.client = new TelegramClient(
      this.sessionManager.getSession(),
      apiId,
      apiHash,
      { connectionRetries: 5 },
    )
  }

  /**
   * Get the Telegram client instance
   */
  public getClient(): TelegramClient {
    return this.client
  }

  /**
   * Check if the client is connected and authorized
   */
  public async isConnected(): Promise<boolean> {
    try {
      return await this.errorHandler.withRetry(
        () => this.client.isUserAuthorized(),
        {
          context: '检查连接状态',
          maxRetries: 2,
          initialDelay: 500,
          throwAfterRetries: false,
        },
      ).then(result => result.success && result.data === true)
    }
    catch (error) {
      this.logger.withError(error).error('检查连接状态失败')
      return false
    }
  }

  /**
   * Connect to Telegram and authenticate if needed
   */
  public async connect(options?: ConnectOptions): Promise<void> {
    try {
      // Load session
      const session = await this.sessionManager.loadSession()

      if (session) {
        this.client.session = this.sessionManager.getSession()
      }

      // Connect to Telegram
      await this.errorHandler.withRetry(
        () => this.client.connect(),
        {
          context: '连接到Telegram',
          maxRetries: 5,
          initialDelay: 1000,
        },
      )

      // Check if user is authorized
      const isAuthorized = await this.client.isUserAuthorized()

      if (!isAuthorized) {
        // Sign in user
        await this.errorHandler.withRetry(
          () => this.client.signInUser(
            {
              apiId: this.apiId,
              apiHash: this.apiHash,
            },
            {
              phoneNumber: this.phoneNumber,
              phoneCode: async () => {
                if (typeof options?.code === 'function') {
                  return options.code()
                }
                return options?.code || ''
              },
              password: async () => {
                if (typeof options?.password === 'function') {
                  return options.password()
                }
                return options?.password || ''
              },
              onError: (err: Error) => {
                this.errorHandler.handleError(err, '登录过程', '登录失败')
                throw err
              },
            },
          ),
          {
            context: '用户登录',
            maxRetries: 3,
            initialDelay: 2000,
          },
        )
      }

      // Save session
      const sessionString = await this.client.session.save() as unknown as string
      await this.sessionManager.saveSession(sessionString)
      this.logger.log('登录成功')
    }
    catch (error: any) {
      // We don't retry here as the individual operations already have retry logic
      this.errorHandler.handleError(error, '连接过程', '连接失败')
      throw error
    }
  }

  /**
   * Disconnect from Telegram
   */
  public async disconnect(): Promise<void> {
    await this.errorHandler.withRetry(
      () => this.client.disconnect(),
      {
        context: '断开连接',
        maxRetries: 2,
        initialDelay: 500,
        throwAfterRetries: false,
      },
    )
  }
}
