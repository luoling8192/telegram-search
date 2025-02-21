import { useDB, useLogger } from '@tg-search/common'
import { sql } from 'drizzle-orm'

/**
 * Create indexes for message tables
 */
export async function createMessageIndexes() {
  const logger = useLogger()
  logger.log('正在创建消息表索引...')

  // Get all message tables
  const tables = await useDB().execute<{ table_name: string }>(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'messages_%'
  `)

  // Create indexes for each table
  for (const { table_name } of tables) {
    try {
      logger.log(`正在为表 ${table_name} 创建索引...`)

      // Create standard indexes
      await useDB().execute(sql`
        -- Composite unique index for chat_id and id
        CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier(`${table_name}_chat_id_id_unique`)}
        ON ${sql.identifier(table_name)} (chat_id, id);

        -- Index for message type
        CREATE INDEX IF NOT EXISTS ${sql.identifier(`${table_name}_type_idx`)}
        ON ${sql.identifier(table_name)} (type);

        -- Unique index for id
        CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier(`${table_name}_id_idx`)}
        ON ${sql.identifier(table_name)} (id);

        -- Descending index for created_at
        CREATE INDEX IF NOT EXISTS ${sql.identifier(`${table_name}_created_at_idx`)}
        ON ${sql.identifier(table_name)} (created_at DESC);

        -- Vector similarity search index
        CREATE INDEX IF NOT EXISTS ${sql.identifier(`${table_name}_embedding_idx`)}
        ON ${sql.identifier(table_name)}
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `)

      logger.log(`表 ${table_name} 索引创建完成`)
    }
    catch (error) {
      logger.withError(error).error(`创建表 ${table_name} 的索引失败`)
    }
  }

  logger.log('所有消息表索引创建完成')
}
