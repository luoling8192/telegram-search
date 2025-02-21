import type { MessageWithSimilarity } from './types'

import { useDB } from '@tg-search/common'
import { sql } from 'drizzle-orm'

import { createMessageContentTable } from '../../schema'

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
