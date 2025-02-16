import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { eq, isNull, sql } from 'drizzle-orm'

import { useDB } from '../composable/db'
import { createMessageContentTable } from '../db/schema/message'

// Export types
export type MessageContent = InferSelectModel<ReturnType<typeof createMessageContentTable>>
export type MessageContentInsert = InferInsertModel<ReturnType<typeof createMessageContentTable>>

/**
 * Get messages without embeddings
 */
export async function getMessagesWithoutEmbedding(chatId: number, limit: number) {
  const contentTable = createMessageContentTable(chatId)
  return db
    .select({
      id: contentTable.id,
      content: contentTable.content,
      chatId: contentTable.chatId,
    })
    .from(contentTable)
    .where(isNull(contentTable.embedding))
    .limit(limit)
}

/**
 * Update message embedding
 */
export async function updateMessageEmbedding(chatId: number, messageId: number, embedding: number[]) {
  const contentTable = createMessageContentTable(chatId)
  return db
    .update(contentTable)
    .set({ embedding })
    .where(eq(contentTable.id, messageId))
}

/**
 * Find similar messages by vector similarity
 */
export async function findSimilarMessagesByEmbedding(chatId: number, embedding: number[], limit = 10, offset = 0) {
  const contentTable = createMessageContentTable(chatId)
  const embeddingStr = `'[${embedding.join(',')}]'`

  return useDB().select({
    id: contentTable.id,
    chatId: contentTable.chatId,
    type: contentTable.type,
    content: contentTable.content,
    createdAt: contentTable.createdAt,
    fromId: contentTable.fromId,
    similarity: sql<number>`1 - (${contentTable.embedding} <=> ${sql.raw(embeddingStr)}::vector)`.as('similarity'),
  }).from(contentTable).where(sql`${contentTable.embedding} IS NOT NULL`).orderBy(sql`${contentTable.embedding} <=> ${sql.raw(embeddingStr)}::vector`).limit(limit).offset(offset)
}

/**
 * Insert message content
 */
export async function insertMessageContent(chatId: number, content: MessageContentInsert | MessageContentInsert[]) {
  const contentTable = createMessageContentTable(chatId)
  return db
    .insert(contentTable)
    .values(content)
    .onConflictDoNothing()
}
