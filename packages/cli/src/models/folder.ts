import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { sql } from 'drizzle-orm'

import { useDB } from '../composable/db'
import { folders } from '../db/schema/folder'

// Export types
export type Folder = InferSelectModel<typeof folders>
export type NewFolder = InferInsertModel<typeof folders>

/**
 * Update or create a folder in the database
 */
export async function updateFolder(data: NewFolder) {
  return useDB().insert(folders).values(data).onConflictDoUpdate({
    target: folders.id,
    set: {
      title: data.title,
      emoji: data.emoji,
      lastSyncTime: data.lastSyncTime,
    },
  }).returning()
}

/**
 * Get all folders from the database
 */
export async function getAllFolders() {
  return useDB().select().from(folders)
}

/**
 * Get folder count
 */
export async function getFolderCount() {
  const [result] = await useDB()
    .select({ count: sql<number>`count(*)` })
    .from(folders)
  return Number(result.count)
}

/**
 * Delete all folders
 */
export async function deleteAllFolders() {
  return useDB().delete(folders)
}
