import type { ConnectOptions } from '../../types'
import type { SessionManager } from './session-manager'

import { useLogger } from '@tg-search/common'
import { TelegramClient } from 'telegram'

/**
 * Manager for Telegram client connection
 * Handles connection establishment, authentication and session management
 */
export class ConnectionManager {
  private client: TelegramClient
  private sessionManager: SessionManager
  private logger = useLogger()
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
    return this.client.isUserAuthorized()
  }

  /**
   * Connect to Telegram and authenticate if needed
   */
  public async connect(options?: ConnectOptions): Promise<void> {
    try {
      const session = await this.sessionManager.loadSession()

      if (session) {
        this.client.session = this.sessionManager.getSession()
      }

      await this.client.connect()

      if (!await this.client.isUserAuthorized()) {
        await this.client.signInUser(
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
              this.logger.withError(err).error('登录失败')
              throw err
            },
          },
        )
      }

      const sessionString = await this.client.session.save() as unknown as string
      await this.sessionManager.saveSession(sessionString)
      this.logger.log('登录成功')
    }
    catch (error) {
      this.logger.withError(error).error('连接失败')
      throw error
    }
  }

  /**
   * Disconnect from Telegram
   */
  public async disconnect(): Promise<void> {
    await this.client.disconnect()
  }
}
