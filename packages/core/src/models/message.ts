import type { PgColumn } from 'drizzle-orm/pg-core'
import type { Message } from '../db'

import { eq, sql } from 'drizzle-orm'

import { db, messages } from '../db'

interface Response {
  items: Message[]
  total: number
}

function generateVectorSQL(column: PgColumn, query: string) {
  return sql`to_tsvector('simple', ${column}) @@ to_tsquery('simple', ${query})`
}

export async function searchMessages(query: string, limit?: number): Promise<Response> {
  const result = await db
    .select()
    .from(messages)
    .where(generateVectorSQL(messages.partitionTable, query))
    .limit(limit || 10)

  return {
    items: result,
    total: result.length,
  } satisfies Response
}

export async function getMessageById(id: number): Promise<Response> {
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1)

  return {
    items: [message],
    total: 1,
  } satisfies Response
}

// export async function listMessagesByChannelId(channelId: string, limit?: number): Promise<Response> {
//   const tableName = `messages_${channelId}`
//   const dbResult = await db
//     .select()
//     .from(sql.raw(tableName))
//     .limit(limit || 10)

//   return {
//     items: dbResult,
//     total: dbResult.length,
//   } satisfies Response
// }
