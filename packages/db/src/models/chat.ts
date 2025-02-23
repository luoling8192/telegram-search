import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { useDB } from '@tg-search/common'
import { eq, sql } from 'drizzle-orm'

import { chats } from '../schema/chat'
import { getMessageStats } from './message'

// Export types
export type DatabaseChat = InferSelectModel<typeof chats>
export type DatabaseNewChat = InferInsertModel<typeof chats>

/**
 * Update or create a chat in the database
 */
export async function updateChat(data: DatabaseNewChat) {
  // Get message stats from materialized view
  let stats = null
  try {
    stats = await getMessageStats(data.id)
  }
  catch (error) {
    // Skip if message stats table does not exist
    if (!(error instanceof Error) || !error.message.includes('does not exist')) {
      throw error
    }
  }

  return useDB().insert(chats).values({
    ...data,
    // Use stats from materialized view
    messageCount: stats?.message_count || 0,
    lastMessage: stats?.last_message || data.lastMessage,
    lastMessageDate: stats?.last_message_date ? new Date(stats.last_message_date) : (data.lastMessageDate ? new Date(data.lastMessageDate) : null),
  }).onConflictDoUpdate({
    target: chats.id,
    set: {
      title: data.title,
      type: data.type,
      lastMessage: stats?.last_message || data.lastMessage,
      lastMessageDate: stats?.last_message_date ? new Date(stats.last_message_date) : (data.lastMessageDate ? new Date(data.lastMessageDate) : null),
      lastSyncTime: data.lastSyncTime ? new Date(data.lastSyncTime) : new Date(),
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
