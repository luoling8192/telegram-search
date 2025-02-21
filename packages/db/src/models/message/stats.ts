import { useDB, useLogger } from '@tg-search/common'
import { sql } from 'drizzle-orm'

const logger = useLogger()

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
