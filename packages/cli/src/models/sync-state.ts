import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { eq } from 'drizzle-orm'

import { db, syncState } from '../db'

// Export types
export type SyncState = InferSelectModel<typeof syncState>
export type SyncStateInsert = InferInsertModel<typeof syncState>

/**
 * Get sync state for a chat
 */
export async function getSyncState(chatId: number) {
  const [result] = await db
    .select()
    .from(syncState)
    .where(eq(syncState.chatId, chatId))
    .limit(1)
  return result
}

/**
 * Update sync state for a chat
 */
export async function updateSyncState(state: SyncStateInsert) {
  return db
    .insert(syncState)
    .values(state)
    .onConflictDoUpdate({
      target: syncState.chatId,
      set: {
        lastMessageId: state.lastMessageId,
        lastSyncTime: state.lastSyncTime,
      },
    })
}

/**
 * Delete sync state for a chat
 */
export async function deleteSyncState(chatId: number) {
  return db
    .delete(syncState)
    .where(eq(syncState.chatId, chatId))
}
