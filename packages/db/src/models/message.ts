import type { MessageType } from '../schema/types'

import { useDB, useLogger } from '@tg-search/common'
import { sql } from 'drizzle-orm'

import { createChatPartition, createMessageContentTable } from '../schema/message'

const logger = useLogger()

/**
 * Message input interface
 */
export interface MessageCreateInput {
  id: number
  chatId: number
  type?: MessageType
  content?: string
  fromId?: number
  fromName?: string
  fromAvatar?: {
    type: 'photo' | 'emoji'
    value: string
    color?: string
  }
  replyToId?: number
  forwardFromChatId?: number
  forwardFromChatName?: string
  forwardFromMessageId?: number
  views?: number
  forwards?: number
  links?: string[]
  metadata?: Record<string, unknown>
  createdAt: Date
}

/**
 * Search options interface
 */
export interface SearchOptions {
  chatId: number // Required for partition table lookup
  type?: MessageType
  startTime?: Date
  endTime?: Date
  limit?: number
  offset?: number
}

/**
 * Message with similarity score interface
 */
interface MessageWithSimilarity {
  id: number
  chatId: number
  type: MessageType
  content: string | null
  createdAt: Date
  fromId: number | null
  similarity: number
}

/**
 * Create new messages in a partition table
 */
export async function createMessage(data: MessageCreateInput | MessageCreateInput[]): Promise<void> {
  const messageArray = Array.isArray(data) ? data : [data]

  try {
    // Create partition tables if not exist
    const chatIds = [...new Set(messageArray.map(msg => msg.chatId))]
    for (const chatId of chatIds) {
      // Create partition table and materialized view
      await useDB().execute(createChatPartition(chatId))
    }

    // Insert messages into partition tables
    await Promise.all(
      chatIds.map(async (chatId) => {
        const chatMessages = messageArray.filter(msg => msg.chatId === chatId)
        const contentTable = createMessageContentTable(chatId)

        // Insert into partition table with upsert
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
            fromName: msg.fromName || null,
            fromAvatar: msg.fromAvatar || null,
            replyToId: msg.replyToId || null,
            forwardFromChatId: msg.forwardFromChatId || null,
            forwardFromChatName: msg.forwardFromChatName || null,
            forwardFromMessageId: msg.forwardFromMessageId || null,
            views: msg.views || null,
            forwards: msg.forwards || null,
            metadata: msg.metadata || null,
            links: msg.links || null,
          })),
        ).onConflictDoNothing({
          target: [contentTable.id],
        })

        // Refresh materialized view
        await refreshMessageStats(chatId)
      }),
    )

    logger.debug(`已保存 ${messageArray.length} 条消息`)
  }
  catch (error) {
    logger.withError(error).error('保存消息失败')
    throw error
  }
}

/**
 * Refresh message stats materialized view for a chat
 */
export async function refreshMessageStats(chatId: number) {
  try {
    const absId = chatId < 0 ? -chatId : chatId
    const tableName = `messages_${chatId < 0 ? 'n' : ''}${absId}`
    await useDB().execute(sql`
      REFRESH MATERIALIZED VIEW CONCURRENTLY message_stats_${sql.raw(tableName)}
    `)
  }
  catch (error) {
    // Ignore error if materialized view does not exist
    if (error instanceof Error && error.message.includes('does not exist')) {
      logger.debug(`Materialized view for chat ${chatId} does not exist yet`)
      return
    }
    throw error
  }
}

/**
 * Get message stats for a chat from materialized view
 */
export async function getMessageStats(chatId: number) {
  const absId = chatId < 0 ? -chatId : chatId
  const tableName = `messages_${chatId < 0 ? 'n' : ''}${absId}`
  const [result] = await useDB().execute<{
    message_count: number
    text_count: number
    photo_count: number
    video_count: number
    document_count: number
    sticker_count: number
    other_count: number
    last_message_date: Date
    last_message: string | null
  }>(sql`
    SELECT * FROM message_stats_${sql.raw(tableName)}
    WHERE chat_id = ${chatId}
  `)
  return result
}

/**
 * Find similar messages by vector similarity
 */
export async function findSimilarMessages(embedding: number[], options: SearchOptions): Promise<MessageWithSimilarity[]> {
  const {
    chatId,
    type,
    startTime,
    endTime,
    limit = 10,
    offset = 0,
  } = options

  const contentTable = createMessageContentTable(chatId)
  const embeddingStr = `'[${embedding.join(',')}]'`

  return useDB()
    .select({
      id: contentTable.id,
      chatId: contentTable.chatId,
      type: contentTable.type,
      content: contentTable.content,
      createdAt: contentTable.createdAt,
      fromId: contentTable.fromId,
      similarity: sql<number>`1 - (${contentTable.embedding} <=> ${sql.raw(embeddingStr)}::vector)`.as('similarity'),
    })
    .from(contentTable)
    .where(sql`
      ${contentTable.embedding} IS NOT NULL
      ${type ? sql`AND type = ${type}` : sql``}
      ${startTime ? sql`AND created_at >= ${startTime}` : sql``}
      ${endTime ? sql`AND created_at <= ${endTime}` : sql``}
    `)
    .orderBy(sql`${contentTable.embedding} <=> ${sql.raw(embeddingStr)}::vector`)
    .limit(limit)
    .offset(offset)
}

/**
 * Find messages by chat ID with pagination
 */
export async function findMessagesByChatId(chatId: number, options?: {
  limit?: number
  offset?: number
}) {
  const contentTable = createMessageContentTable(chatId)
  const query = useDB()
    .select()
    .from(contentTable)
    .orderBy(sql`${contentTable.createdAt} DESC`)

  // Get total count first
  const [{ count }] = await useDB()
    .select({ count: sql<number>`count(*)` })
    .from(contentTable)

  // Apply pagination if options provided
  if (options?.limit)
    query.limit(options.limit)
  if (options?.offset)
    query.offset(options.offset)

  const messages = await query

  return {
    items: messages,
    total: Number(count),
  }
}

/**
 * Update message embedding in partition table
 */
export async function updateMessageEmbeddings(chatId: number, updates: Array<{ id: number, embedding: number[] }>) {
  const contentTable = `messages_${chatId}`

  // Update embeddings in batch
  await Promise.all(
    updates.map(async ({ id, embedding }) => {
      await useDB().execute(sql`
        UPDATE ${sql.identifier(contentTable)}
        SET embedding = ${sql.raw(`'[${embedding.join(',')}]'`)}::vector
        WHERE id = ${id} AND chat_id = ${chatId}
      `)
    }),
  )
}

/**
 * Check for duplicate messages in a range
 */
export async function checkDuplicateMessages(chatId: number, id1: number, id2: number): Promise<{
  actualCount: number
  expectedCount: number
}> {
  const contentTable = createMessageContentTable(chatId)
  const minId = Math.min(id1, id2)
  const maxId = Math.max(id1, id2)

  const [result] = await useDB()
    .select({ count: sql<number>`count(*)` })
    .from(contentTable)
    .where(sql`id >= ${minId} AND id <= ${maxId} AND chat_id = ${chatId}`)

  return {
    actualCount: Number(result.count),
    expectedCount: Math.abs(id2 - id1) + 1,
  }
}

/**
 * Create messages in batch
 */
export async function createMessageBatch(messages: MessageCreateInput[]): Promise<void> {
  if (messages.length === 0) {
    return
  }

  try {
    // Create messages
    await createMessage(messages)
  }
  catch (error) {
    logger.withError(error).error('保存消息批次失败')
    throw error
  }
}

/**
 * Find messages by text search
 */
export async function findMessagesByText(query: string, options: {
  chatId?: number
  limit?: number
  offset?: number
}): Promise<{ items: MessageWithSimilarity[], total: number }> {
  const { chatId, limit = 20, offset = 0 } = options

  // Convert query to tsquery format
  const tsquery = query
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `${term}:*`)
    .join(' & ')

  if (chatId) {
    // Search in specific chat
    const contentTable = createMessageContentTable(chatId)
    const [{ count }] = await useDB()
      .select({ count: sql<number>`count(*)` })
      .from(contentTable)
      .where(sql`ts_content @@ to_tsquery('telegram_search', ${tsquery})`)

    const items = await useDB()
      .select({
        id: contentTable.id,
        chatId: contentTable.chatId,
        type: contentTable.type,
        content: contentTable.content,
        createdAt: contentTable.createdAt,
        fromId: contentTable.fromId,
        similarity: sql<number>`
          CASE 
            WHEN ts_content @@ to_tsquery('telegram_search', ${tsquery}) THEN 1.0
            ELSE ts_rank(ts_content, to_tsquery('telegram_search', ${tsquery})) * 0.5
          END
        `.as('similarity'),
      })
      .from(contentTable)
      .where(sql`ts_content @@ to_tsquery('telegram_search', ${tsquery})`)
      .orderBy(sql`similarity DESC`)
      .limit(limit)
      .offset(offset)

    return {
      items,
      total: Number(count),
    }
  }
  else {
    // Search in all chats
    // Get all chat IDs first
    const chats = await useDB().execute<{ id: number }>(sql`
      SELECT DISTINCT id FROM chats
    `)

    // Search in each chat
    const results = await Promise.all(
      chats.map(async ({ id }) => {
        const contentTable = createMessageContentTable(id)
        return useDB()
          .select({
            id: contentTable.id,
            chatId: contentTable.chatId,
            type: contentTable.type,
            content: contentTable.content,
            createdAt: contentTable.createdAt,
            fromId: contentTable.fromId,
            similarity: sql<number>`
              CASE 
                WHEN ts_content @@ to_tsquery('telegram_search', ${tsquery}) THEN 1.0
                ELSE ts_rank(ts_content, to_tsquery('telegram_search', ${tsquery})) * 0.5
              END
            `.as('similarity'),
          })
          .from(contentTable)
          .where(sql`ts_content @@ to_tsquery('telegram_search', ${tsquery})`)
      }),
    )

    // Merge and sort results
    const allItems = results
      .flat()
      .sort((a, b) => b.similarity - a.similarity)

    const total = allItems.length
    const items = allItems.slice(offset, offset + limit)

    return {
      items,
      total,
    }
  }
}
