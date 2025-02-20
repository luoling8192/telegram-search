import { useDB, useLogger } from '@tg-search/common'
import { sql } from 'drizzle-orm'

/**
 * Migrate existing message tables
 */
export async function migrateMessageTables() {
  const logger = useLogger()
  logger.log('正在迁移消息表...')

  // Get all message tables
  const tables = await useDB().execute<{ table_name: string }>(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'messages_%'
  `)

  // Add ts_content column to each table
  for (const { table_name } of tables) {
    try {
      // Check if ts_content column exists
      const columns = await useDB().execute<{ column_name: string }>(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${table_name}
          AND column_name = 'ts_content'
      `)

      if (columns.length === 0) {
        logger.log(`正在为表 ${table_name} 添加全文搜索列...`)
        // Split into two separate queries to avoid issues with sql.raw
        await useDB().execute(sql`
          ALTER TABLE ${sql.identifier(table_name)}
          ADD COLUMN ts_content tsvector
          GENERATED ALWAYS AS (to_tsvector('telegram_search', coalesce(content, ''))) STORED
        `)

        await useDB().execute(sql`
          CREATE INDEX IF NOT EXISTS ${sql.identifier(`${table_name}_ts_content_idx`)}
          ON ${sql.identifier(table_name)} USING GIN (ts_content)
        `)

        logger.log(`表 ${table_name} 迁移完成`)
      }
      else {
        logger.debug(`表 ${table_name} 已经有全文搜索列`)
      }
    }
    catch (error) {
      logger.withError(error).error(`迁移表 ${table_name} 失败`)
    }
  }

  logger.log('所有消息表迁移完成')
}
