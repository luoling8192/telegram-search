import type { TelegramClient } from 'telegram'

import { useLogger } from '@tg-search/common'
import { getUser, upsertUser } from '@tg-search/db'
import { Api } from 'telegram'

/**
 * Handles resolution and caching of Telegram user information
 */
export class UserResolver {
  private logger = useLogger('user-resolver')

  constructor(
    private readonly client: TelegramClient,
  ) {}

  /**
   * Get and cache user information from Telegram API
   */
  private async getUserInfo(userId: number): Promise<{
    username?: string
    displayName: string
  } | null> {
    try {
      const sender = await this.client.getEntity(userId)

      if (sender instanceof Api.User) {
        const displayName = [sender.firstName, sender.lastName].filter(Boolean).join(' ')

        this.logger.withFields({
          userId,
          displayName,
        }).debug('Got user info')

        // Cache user information
        await upsertUser({
          id: userId,
          username: sender.username || undefined,
          displayName,
          updatedAt: new Date(),
        })

        return {
          username: sender.username || undefined,
          displayName,
        }
      }
    }
    catch (error) {
      // Ignore errors when getting user info
      this.logger.withFields({
        userId,
        error: error instanceof Error ? error.message : String(error),
      }).warn('Failed to get user info')
    }
    return null
  }

  /**
   * Get user information from cache or API
   * If not found in cache, fetch from API and update cache
   */
  async resolveUser(userId: number): Promise<{
    username?: string
    displayName: string
  } | null> {
    try {
      // Try to get from cache first
      const user = await getUser(userId)
      if (user) {
        return {
          username: user.username || undefined,
          displayName: user.displayName,
        }
      }

      // If not in cache, fetch from API and update cache
      return await this.getUserInfo(userId)
    }
    catch (error) {
      // Ignore errors when getting user info from cache
      this.logger.withFields({
        userId,
        error: error instanceof Error ? error.message : String(error),
      }).warn('Failed to get user info from cache')
      return null
    }
  }
} 
