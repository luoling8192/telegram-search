import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { useDB } from '@tg-search/common'
import { eq, sql } from 'drizzle-orm'

import { chats } from '../schema/chat'
import { getMessageStats } from './message'

// Export types
export type Chat = InferSelectModel<typeof chats>
export type NewChat = InferInsertModel<typeof chats>

/**
 * Update or create a chat in the database
 */
export async function updateChat(data: NewChat) {
  // Get message stats from materialized view
  const stats = await getMessageStats(data.id)

  return useDB().insert(chats).values({
    ...data,
    // Use stats from materialized view
    messageCount: stats?.message_count || 0,
    lastMessage: stats?.last_message || data.lastMessage,
    lastMessageDate: stats?.last_message_date || data.lastMessageDate,
  }).onConflictDoUpdate({
    target: chats.id,
    set: {
      title: data.title,
      type: data.type,
      username: data.username,
      lastMessage: stats?.last_message || data.lastMessage,
      lastMessageDate: stats?.last_message_date || data.lastMessageDate,
      lastSyncTime: data.lastSyncTime,
      messageCount: stats?.message_count || 0,
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
