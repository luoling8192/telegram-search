import { useDB } from '@tg-search/common'
import { sql } from 'drizzle-orm'

import { useMessageTable } from '../../schema'

/**
 * Check for duplicate messages in a range
 */
export async function checkDuplicateMessages(chatId: number, id1: number, id2: number): Promise<{
  actualCount: number
  expectedCount: number
}> {
  const contentTable = await useMessageTable(chatId)
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
