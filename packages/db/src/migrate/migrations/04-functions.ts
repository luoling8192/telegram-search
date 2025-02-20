import { useDB, useLogger } from '@tg-search/common'
import { sql } from 'drizzle-orm'

/**
 * Create database functions
 */
export async function createFunctions() {
  const logger = useLogger()

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
    AS $function$
    DECLARE
      partition_table text;
      query text;
    BEGIN
      FOR partition_table IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE 'messages_%'
          AND (filter_chat_id IS NULL OR table_name = 'messages_' || filter_chat_id)
      LOOP
        query := format(
          'SELECT
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
            AND (%L::text IS NULL OR type::text = %L)
            AND (%L::timestamp IS NULL OR created_at >= %L)
            AND (%L::timestamp IS NULL OR created_at <= %L)
          ORDER BY embedding <=> %L::vector
          LIMIT %s',
          query_embedding,
          partition_table,
          query_embedding,
          match_threshold,
          filter_type,
          filter_type,
          filter_start_time,
          filter_start_time,
          filter_end_time,
          filter_end_time,
          query_embedding,
          match_count
        );
        
        RETURN QUERY EXECUTE query;
      END LOOP;
    END;
    $function$;
  `)
  logger.log('相似度搜索函数创建完成')
}
