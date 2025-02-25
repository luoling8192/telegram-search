import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { useLogger } from '@tg-search/common'
import { StringSession } from 'telegram/sessions'

import { ErrorHandler } from './utils/error-handler'

/**
 * Manages Telegram session persistence and loading
 */
export class SessionManager {
  private session: StringSession
  private logger = useLogger()
  private errorHandler = new ErrorHandler()

  constructor(
    private readonly sessionFile: string,
  ) {
    this.session = new StringSession('')
  }

  /**
   * Convert any error to Error type
   */
  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error
    }
    return new Error(String(error))
  }

  /**
   * Get current session
   */
  getSession(): StringSession {
    return this.session
  }

  /**
   * Load session string from file
   */
  async loadSession(): Promise<string> {
    try {
      await this.errorHandler.withRetry(
        async () => {
          await fs.mkdir(path.dirname(this.sessionFile), { recursive: true })
        },
        {
          context: '创建会话目录',
          maxRetries: 3,
          initialDelay: 1000,
        },
      )

      const fileReadResult = await this.errorHandler.withRetry(
        async () => {
          return await fs.readFile(this.sessionFile, 'utf-8')
        },
        {
          context: '读取会话文件',
          maxRetries: 3,
          initialDelay: 1000,
        },
      )

      if (fileReadResult.success && fileReadResult.data) {
        const session = fileReadResult.data
        this.session = new StringSession(session)
        return session
      }

      // If file doesn't exist or is empty, return empty string
      return ''
    }
    catch (error) {
      // For session loading, we log the error but don't throw it to allow
      // the application to continue without a session (will require login)
      this.errorHandler.handleError(
        this.toError(error),
        '加载会话',
        '无法加载会话文件，可能需要重新登录',
      )
      return ''
    }
  }

  /**
   * Save session string to file
   */
  async saveSession(session: string): Promise<void> {
    try {
      await this.errorHandler.withRetry(
        async () => {
          await fs.mkdir(path.dirname(this.sessionFile), { recursive: true })
        },
        {
          context: '创建会话目录',
          maxRetries: 3,
          initialDelay: 1000,
        },
      )

      await this.errorHandler.withRetry(
        async () => {
          await fs.writeFile(this.sessionFile, session, 'utf-8')
        },
        {
          context: '保存会话文件',
          maxRetries: 3,
          initialDelay: 1000,
        },
      )

      this.session = new StringSession(session)
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '保存会话', '无法保存会话信息')
      throw error
    }
  }
}
