import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { useLogger } from '@tg-search/common'
import { StringSession } from 'telegram/sessions'

/**
 * Manages Telegram session persistence and loading
 */
export class SessionManager {
  private session: StringSession
  private logger = useLogger('session')

  constructor(
    private readonly sessionFile: string,
  ) {
    this.session = new StringSession('')
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
      await fs.mkdir(path.dirname(this.sessionFile), { recursive: true })
      const session = await fs.readFile(this.sessionFile, 'utf-8')
      this.session = new StringSession(session)
      return session
    }
    catch {
      return ''
    }
  }

  /**
   * Save session string to file
   */
  async saveSession(session: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.sessionFile), { recursive: true })
      await fs.writeFile(this.sessionFile, session, 'utf-8')
      this.session = new StringSession(session)
    }
    catch (error) {
      this.logger.withError(error).error('Failed to save session')
      throw error
    }
  }
}
