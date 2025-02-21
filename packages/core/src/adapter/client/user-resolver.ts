import type { TelegramClient } from 'telegram'

import { useLogger } from '@tg-search/common'
import { getUser, upsertUser } from '@tg-search/db'
import { Api } from 'telegram'

/**
 * Handles resolution and caching of Telegram user information
 */
export class UserResolver {
  private logger = useLogger()
  // In-memory cache for user info
  private memoryCache = new Map<number, {
    username?: string
    displayName: string
    updatedAt: Date
  }>()

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
      this.logger.debug(`Fetching user info from Telegram API for user ${userId}`)
      const sender = await this.client.getEntity(userId)

      if (sender instanceof Api.User) {
        const displayName = [sender.firstName, sender.lastName].filter(Boolean).join(' ')
          || sender.username
          || `User ${userId}`

        this.logger.withFields({
          userId,
          displayName,
          username: sender.username,
          firstName: sender.firstName,
          lastName: sender.lastName,
        }).debug('Got user info from Telegram API')

        const userInfo = {
          username: sender.username || undefined,
          displayName,
          updatedAt: new Date(),
        }

        // Cache in memory
        this.memoryCache.set(userId, userInfo)

        // Cache in database
        await upsertUser({
          id: userId,
          username: sender.username || undefined,
          displayName,
          updatedAt: userInfo.updatedAt,
        })

        return {
          username: userInfo.username,
          displayName: userInfo.displayName,
        }
      }
      else {
        this.logger.withFields({
          userId,
          entityType: sender.className,
        }).warn('Entity is not a user')
      }
    }
    catch (error) {
      // Log more details about the error
      this.logger.withFields({
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }).warn('Failed to get user info from Telegram API')
    }
    return null
  }

  /**
   * Get user information from memory cache, database cache or API
   * If not found in cache, fetch from API and update caches
   * If cache is older than 7 days, refresh from API
   */
  async resolveUser(userId: number): Promise<{
    username?: string
    displayName: string
  } | null> {
    try {
      // Check memory cache first
      const memCached = this.memoryCache.get(userId)
      if (memCached) {
        const cacheAge = Date.now() - memCached.updatedAt.getTime()
        const cacheExpired = cacheAge > 7 * 24 * 60 * 60 * 1000 // 7 days

        if (!cacheExpired) {
          // this.logger.withFields({
          //   userId,
          //   displayName: memCached.displayName,
          //   cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1000)), // days
          //   source: 'memory'
          // }).debug('Got user info from memory cache')

          return {
            username: memCached.username,
            displayName: memCached.displayName,
          }
        }

        this.logger.withFields({
          userId,
          cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1000)), // days
        }).debug('Memory cache expired, refreshing from API')
      }

      // Try database cache if not in memory
      const dbUser = await getUser(userId)
      if (dbUser) {
        const cacheAge = Date.now() - dbUser.updatedAt.getTime()
        const cacheExpired = cacheAge > 7 * 24 * 60 * 60 * 1000 // 7 days

        if (!cacheExpired) {
          // Update memory cache
          this.memoryCache.set(userId, {
            username: dbUser.username || undefined,
            displayName: dbUser.displayName,
            updatedAt: dbUser.updatedAt,
          })

          this.logger.withFields({
            userId,
            displayName: dbUser.displayName,
            cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1000)), // days
            source: 'database',
          }).debug('Got user info from database cache')

          return {
            username: dbUser.username || undefined,
            displayName: dbUser.displayName,
          }
        }

        this.logger.withFields({
          userId,
          cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1000)), // days
        }).debug('Database cache expired, refreshing from API')
      }
      else {
        this.logger.debug(`User ${userId} not found in any cache`)
      }

      // If not in cache or cache expired, fetch from API and update caches
      return await this.getUserInfo(userId)
    }
    catch (error) {
      // Log more details about the error
      this.logger.withFields({
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }).warn('Failed to resolve user info')
      return null
    }
  }
}
