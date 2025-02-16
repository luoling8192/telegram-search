import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import type { messageTypeEnum } from '../db/schema/types'

import { useLogger } from '@tg-search/common'
import { and, count, eq, gt, lt, sql } from 'drizzle-orm'

import { useDB } from '../composable/db'
import { createChatPartition, createMessageContentTable, messages } from '../db/schema/message'

const logger = useLogger()

// Export types
export type Message = InferSelectModel<typeof messages>
export type NewMessage = InferInsertModel<typeof messages>
export type MessageType = (typeof messageTypeEnum.enumValues)[number]

export interface MessageCreateInput {
  id: number
  chatId: number
  type?: MessageType
  content?: string
  fromId?: number
  replyToId?: number
  forwardFromChatId?: number
  forwardFromMessageId?: number
  views?: number
  forwards?: number
  createdAt: Date
}

export interface SearchOptions {
  chatId?: number
  type?: MessageType
  startTime?: Date
  endTime?: Date
  limit?: number
  offset?: number
}

interface MessageWithSimilarity {
  id: number
  chatId: number
  type: MessageType
  content: string | null
  createdAt: Date
  fromId: number | null
  similarity: number
}

function generateVectorSQL(column: PgColumn, query: string) {
  return sql`to_tsvector('simple', ${column}) @@ to_tsquery('simple', ${query})`
}

/**
 * Search messages by text query
 */
export async function searchMessages(query: string, limit?: number) {
  const result = await useDB()
    .select()
    .from(messages)
    .where(generateVectorSQL(messages.partitionTable, query))
    .limit(limit || 10)

  return {
    items: result,
    total: result.length,
  }
}

/**
 * Get message by ID
 */
export async function getMessageById(id: number) {
  const [message] = await useDB()
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1)

  return {
    items: [message],
    total: 1,
  }
}

/**
 * Create a new message
 */
export async function createMessage(data: MessageCreateInput | MessageCreateInput[]): Promise<Message[]> {
  const messageArray = Array.isArray(data) ? data : [data]
  logger.debug(`正在保存 ${messageArray.length} 条消息到数据库`)

  try {
    // Create partition tables if not exist
    const chatIds = [...new Set(messageArray.map(msg => msg.chatId))]
    for (const chatId of chatIds) {
      await useDB().execute(createChatPartition(chatId))
    }

    // Insert messages into partition tables and metadata table
    const results = await Promise.all(
      chatIds.map(async (chatId) => {
        const chatMessages = messageArray.filter(msg => msg.chatId === chatId)
        const tableName = `messages_${chatId}`
        const contentTable = createMessageContentTable(chatId)

        // Insert into partition table
        await useDB().insert(contentTable).values(
          chatMessages.map(msg => ({
            id: msg.id,
            chatId: msg.chatId,
            type: msg.type || 'text',
            content: msg.content || null,
            embedding: null,
            mediaInfo: null,
            createdAt: msg.createdAt,
            fromId: msg.fromId || null,
            replyToId: msg.replyToId || null,
            forwardFromChatId: msg.forwardFromChatId || null,
            forwardFromMessageId: msg.forwardFromMessageId || null,
            views: msg.views || null,
            forwards: msg.forwards || null,
          })),
        ).onConflictDoNothing()

        // Insert metadata into messages table
        return useDB().insert(messages).values(chatMessages.map(msg => ({
          id: msg.id,
          chatId: msg.chatId,
          type: msg.type || 'text',
          createdAt: msg.createdAt,
          partitionTable: tableName,
        }))).onConflictDoNothing().returning()
      }),
    )

    const flatResults = results.flat()
    if (flatResults.length > 0) {
      logger.debug(`已保存 ${flatResults.length} 条消息`)
    }

    return flatResults
  }
  catch (error) {
    logger.withError(error).error('保存消息失败')
    throw error
  }
}

/**
 * Get message count
 */
export async function getMessageCount(chatId?: number) {
  const [result] = await useDB()
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(chatId ? eq(messages.chatId, chatId) : undefined)
  return Number(result.count)
}

/**
 * Get last message ID for a chat
 */
export async function getLastMessageId(chatId: number) {
  const result = await useDB()
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.id)
    .limit(1)
  return result[0]?.id || 0
}

/**
 * Get partition tables for a chat
 */
export async function getPartitionTables(chatId?: number) {
  return useDB()
    .select({
      tableName: messages.partitionTable,
      chatId: messages.chatId,
    })
    .from(messages)
    .where(chatId ? eq(messages.chatId, chatId) : undefined)
    .groupBy(messages.partitionTable, messages.chatId)
}

/**
 * Find similar messages by vector similarity
 */
export async function findSimilarMessages(embedding: number[], options: SearchOptions = {}): Promise<MessageWithSimilarity[]> {
  const {
    chatId,
    type,
    startTime,
    endTime,
    limit = 10,
    offset = 0,
  } = options

  // Build where conditions for metadata
  const conditions = []
  if (chatId)
    conditions.push(eq(messages.chatId, chatId))
  if (type)
    conditions.push(eq(messages.type, type))
  if (startTime)
    conditions.push(gt(messages.createdAt, startTime))
  if (endTime)
    conditions.push(lt(messages.createdAt, endTime))

  // Get relevant partition tables
  const partitionTables = await useDB().select({
    tableName: messages.partitionTable,
  }).from(messages).where(and(...conditions)).groupBy(messages.partitionTable)

  // Search in each partition table
  const results = await Promise.all(
    partitionTables.map(async ({ tableName }) => {
      const contentTable = createMessageContentTable(Number(tableName.replace('messages_', '')))
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
    }),
  )

  // Merge and sort results
  return results
    .flat()
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

/**
 * Find messages by chat ID
 */
export async function findMessagesByChatId(chatId: number) {
  const contentTable = createMessageContentTable(chatId)
  return useDB().select().from(contentTable).orderBy(contentTable.createdAt)
}

/**
 * Find message by ID
 */
export async function findMessageById(id: number) {
  return useDB().select().from(messages).where(eq(messages.id, id)).limit(1).then(res => res[0])
}

/**
 * Get message statistics for a chat
 */
export async function getChatStats(chatId: number) {
  const [totalResult, typeResult] = await Promise.all([
    // Get total message count
    useDB().select({ count: count() }).from(messages).where(eq(messages.chatId, chatId)).then(res => res[0].count),

    // Get message count by type
    useDB().select({ type: messages.type, count: count() }).from(messages).where(eq(messages.chatId, chatId)).groupBy(messages.type),
  ])

  return {
    total: Number(totalResult),
    byType: Object.fromEntries(
      typeResult.map(({ type, count }) => [type, Number(count)]),
    ),
  }
}
