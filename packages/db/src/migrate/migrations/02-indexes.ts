import { useDB, useLogger } from '@tg-search/common'
import { sql } from 'drizzle-orm'

/**
 * Create database indexes
 */
export async function createIndexes() {
  const logger = useLogger()

  // Create indexes
  await useDB().execute(sql`
    CREATE INDEX IF NOT EXISTS chats_type_idx ON chats (type);
    CREATE INDEX IF NOT EXISTS chats_last_sync_time_idx ON chats (last_sync_time DESC);
    CREATE INDEX IF NOT EXISTS chats_folder_id_idx ON chats (folder_id);
    CREATE INDEX IF NOT EXISTS chats_last_message_date_idx ON chats (last_message_date DESC);
    CREATE INDEX IF NOT EXISTS folders_last_sync_time_idx ON folders (last_sync_time DESC)
  `)
  logger.log('索引创建完成')
}
