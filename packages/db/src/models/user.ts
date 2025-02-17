import { useDB, useLogger } from '@tg-search/common'
import { eq, inArray } from 'drizzle-orm'

import { userTable } from '../schema/user'

const logger = useLogger('models/user')

/**
 * Get user by ID
 */
export async function getUser(id: number) {
  return useDB()
    .select()
    .from(userTable)
    .where(eq(userTable.id, id))
    .then(rows => rows[0])
}

/**
 * Upsert user information
 */
export async function upsertUser(user: typeof userTable.$inferInsert) {
  try {
    await useDB()
      .insert(userTable)
      .values(user)
      .onConflictDoUpdate({
        target: userTable.id,
        set: {
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          updatedAt: new Date(),
        },
      })
  }
  catch (error) {
    logger.withError(error).error('更新用户信息失败')
    throw error
  }
}

/**
 * Get users by IDs
 */
export async function getUsersByIds(ids: number[]) {
  if (ids.length === 0)
    return []

  return useDB()
    .select()
    .from(userTable)
    .where(inArray(userTable.id, ids))
}
