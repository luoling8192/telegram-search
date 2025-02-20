import { useDB, useLogger } from '@tg-search/common'
import { sql } from 'drizzle-orm'

/**
 * Create required database extensions
 */
export async function createExtensions() {
  const logger = useLogger()

  // Enable pgvector extension
  await useDB().execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
  logger.log('向量扩展创建完成')

  // Create text search configuration if not exists
  await useDB().execute(sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'telegram_search'
      ) THEN
        CREATE TEXT SEARCH CONFIGURATION telegram_search (COPY = simple);
        ALTER TEXT SEARCH CONFIGURATION telegram_search ALTER MAPPING FOR word WITH simple;
      END IF;
    END $$;
  `)
  logger.log('全文搜索配置创建完成')
}
