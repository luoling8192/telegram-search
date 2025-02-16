import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { useDB } from '@tg-search/common'
import { eq, sql } from 'drizzle-orm'

import { chats } from '../schema/chat'

// Export types
export type Chat = InferSelectModel<typeof chats>
export type NewChat = InferInsertModel<typeof chats>

/**
 * Update or create a chat in the database
 */
export async function updateChat(data: NewChat) {
  return useDB().insert(chats).values(data).onConflictDoUpdate({
    target: chats.id,
    set: {
      title: data.title,
      type: data.type,
      username: data.username,
      lastMessage: data.lastMessage,
      lastMessageDate: data.lastMessageDate,
      lastSyncTime: data.lastSyncTime,
      messageCount: data.messageCount,
      folderId: data.folderId,
    },
  }).returning()
}

/**
 * Get all chats from the database
 */
export async function getAllChats() {
  return useDB().select().from(chats).orderBy(chats.lastMessageDate)
}

/**
 * Get chats in a specific folder
 */
export async function getChatsInFolder(folderId: number) {
  return useDB()
    .select()
    .from(chats)
    .where(eq(chats.folderId, folderId))
    .orderBy(chats.lastMessageDate)
}

/**
 * Get chat count
 */
export async function getChatCount() {
  const [result] = await useDB()
    .select({ count: sql<number>`count(*)` })
    .from(chats)
  return Number(result.count)
}

/**
 * Delete all chats
 */
export async function deleteAllChats() {
  return useDB().delete(chats)
}
