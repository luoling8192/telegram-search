import { dirname } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { initConfig, initDB, initLogger, useDB, useLogger } from '@tg-search/common'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// Run migrations
async function main() {
  initLogger()
  const logger = useLogger()
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  // Initialize config
  initConfig()
  initDB()
  logger.log('正在运行数据库迁移...')

  try {
    // Run Drizzle migrations
    logger.log('正在运行 Drizzle 迁移...')
    const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 })
    const db = drizzle(migrationClient)
    await migrate(db, { migrationsFolder: './drizzle' })
    await migrationClient.end()
    logger.log('Drizzle 迁移完成')

    // Enable pgvector extension
    await useDB().execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    logger.log('向量扩展创建完成')

    // Create indexes
    await useDB().execute(sql`
      CREATE INDEX IF NOT EXISTS chats_type_idx ON chats (type);
      CREATE INDEX IF NOT EXISTS chats_last_sync_time_idx ON chats (last_sync_time DESC);
      CREATE INDEX IF NOT EXISTS chats_folder_id_idx ON chats (folder_id);
      CREATE INDEX IF NOT EXISTS chats_last_message_date_idx ON chats (last_message_date DESC);
      CREATE INDEX IF NOT EXISTS folders_last_sync_time_idx ON folders (last_sync_time DESC)
    `)
    logger.log('索引创建完成')

    // Create similarity search function
    await useDB().execute(sql`
      CREATE OR REPLACE FUNCTION similarity_search(
        query_embedding vector(1536),
        match_threshold float,
        match_count int,
        filter_chat_id bigint DEFAULT NULL,
        filter_type text DEFAULT NULL,
        filter_start_time timestamp DEFAULT NULL,
        filter_end_time timestamp DEFAULT NULL
      )
      RETURNS TABLE (
        id bigint,
        chat_id bigint,
        type text,
        content text,
        created_at timestamp,
        similarity float
      )
      LANGUAGE plpgsql
      AS $$
      DECLARE
        partition_table text;
        query text;
      BEGIN
        FOR partition_table IN
          SELECT DISTINCT partition_table
          FROM messages m
          WHERE
            (filter_chat_id IS NULL OR m.chat_id = filter_chat_id)
            AND (filter_type IS NULL OR m.type::text = filter_type)
            AND (filter_start_time IS NULL OR m.created_at >= filter_start_time)
            AND (filter_end_time IS NULL OR m.created_at <= filter_end_time)
        LOOP
          query := format('
            SELECT
              id,
              chat_id,
              type::text,
              content,
              created_at,
              1 - (embedding <=> %L::vector) as similarity
            FROM %I
            WHERE
              embedding IS NOT NULL
              AND 1 - (embedding <=> %L::vector) > %s
            ORDER BY embedding <=> %L::vector
            LIMIT %s
          ',
            query_embedding,
            partition_table,
            query_embedding,
            match_threshold,
            query_embedding,
            match_count
          );
          
          RETURN QUERY EXECUTE query;
        END LOOP;
      END;
      $$;
    `)
    logger.log('相似度搜索函数创建完成')
    process.exit(0)
  }
  catch (error) {
    logger.withError(error).error('数据库迁移失败')
    process.exit(1)
  }
}

main()
