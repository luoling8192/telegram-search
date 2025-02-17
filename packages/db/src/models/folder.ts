import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { useDB } from '@tg-search/common'
import { sql } from 'drizzle-orm'

import { folders } from '../schema/folder'

// Export types
export type Folder = InferSelectModel<typeof folders>
export type NewFolder = InferInsertModel<typeof folders>

/**
 * Update or create a folder in the database
 */
export async function updateFolder(data: NewFolder) {
  return useDB().insert(folders).values({
    ...data,
    lastSyncTime: data.lastSyncTime ? new Date(data.lastSyncTime) : new Date(),
  }).onConflictDoUpdate({
    target: folders.id,
    set: {
      title: data.title,
      emoji: data.emoji,
      lastSyncTime: data.lastSyncTime ? new Date(data.lastSyncTime) : new Date(),
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
