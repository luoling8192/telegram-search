import type { SQL } from 'drizzle-orm'
import type { MediaInfo } from './types'

import { useDB } from '@tg-search/common'
import { vector } from '@tg-search/pg-vector'
import { sql } from 'drizzle-orm'
import { bigint, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { tsvector } from './tsvector'
import { messageTypeEnum } from './types'

/**
 * Get table name for a chat partition
 * Handles negative chat IDs by prefixing with 'n'
 */
function getTableName(chatId: number | bigint): string {
  const absId = chatId < 0 ? -chatId : chatId
  const prefix = chatId < 0 ? 'n' : ''
  return `messages_${prefix}${absId}`
}

/**
 * Base schema for message tables
 * Defines common columns and their types
 */
const messageTableSchema = {
  uuid: uuid('uuid').defaultRandom().primaryKey(),
  id: bigint('id', { mode: 'number' }).notNull(),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  type: messageTypeEnum('type').notNull().default('text'),
  content: text('content'),
  embedding: vector('embedding'),
  tsContent: tsvector('ts_content'),
  mediaInfo: jsonb('media_info').$type<MediaInfo>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  fromId: bigint('from_id', { mode: 'number' }),
  fromName: text('from_name'),
  fromAvatar: jsonb('from_avatar').$type<{
    type: 'photo' | 'emoji'
    value: string
    color?: string
  }>(),
  replyToId: bigint('reply_to_id', { mode: 'number' }),
  forwardFromChatId: bigint('forward_from_chat_id', { mode: 'number' }),
  forwardFromChatName: text('forward_from_chat_name'),
  forwardFromMessageId: bigint('forward_from_message_id', { mode: 'number' }),
  views: integer('views'),
  forwards: integer('forwards'),
  links: jsonb('links').$type<string[]>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}

/**
 * Index configuration type
 */
interface TableIndex {
  name: string
  columns: string[]
  unique?: boolean
  desc?: boolean
}

/**
 * Generate table indexes including specialized PostgreSQL features
 */
function createTableIndexes(tableName: string, table: any): Array<TableIndex | SQL> {
  return [
    {
      name: `${tableName}_chat_id_id_unique`,
      columns: ['chat_id', 'id'],
      unique: true,
    },
    sql`CREATE INDEX IF NOT EXISTS ${sql.raw(tableName)}_embedding_idx 
      ON ${table} 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)`,
    sql`CREATE INDEX IF NOT EXISTS ${sql.raw(tableName)}_ts_content_idx
      ON ${table}
      USING GIN (ts_content)`,
    {
      name: `${tableName}_created_at_idx`,
      columns: ['created_at'],
      desc: true,
    },
    {
      name: `${tableName}_type_idx`,
      columns: ['type'],
    },
    {
      name: `${tableName}_id_idx`,
      columns: ['id'],
      unique: true,
    },
  ]
}

/**
 * Create message table for a specific chat with all required columns and indexes
 */
export function createMessageContentTable(chatId: number | bigint) {
  const tableName = getTableName(chatId)
  const table = pgTable(tableName, messageTableSchema)

  // Create base table with generated tsvector column
  useDB().execute(sql`
    CREATE TABLE IF NOT EXISTS ${table} (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      id BIGINT NOT NULL,
      chat_id BIGINT NOT NULL,
      type message_type NOT NULL DEFAULT 'text',
      content TEXT,
      embedding VECTOR(1536),
      ts_content TSVECTOR GENERATED ALWAYS AS (to_tsvector('telegram_search', coalesce(content, ''))) STORED,
      media_info JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      from_id BIGINT,
      from_name TEXT,
      from_avatar JSONB,
      reply_to_id BIGINT,
      forward_from_chat_id BIGINT,
      forward_from_chat_name TEXT,
      forward_from_message_id BIGINT,
      views INTEGER,
      forwards INTEGER,
      links JSONB,
      metadata JSONB
    )
  `)

  // Create all indexes
  createTableIndexes(tableName, table).forEach((index) => {
    if ('name' in index) {
      useDB().execute(sql`
        CREATE ${index.unique ? sql`UNIQUE` : sql``} INDEX IF NOT EXISTS ${sql.raw(index.name)}
        ON ${table} (${sql.raw(index.columns.join(', '))})
        ${index.desc ? sql`DESC` : sql``}
      `)
    }
    else {
      useDB().execute(index)
    }
  })

  return table
}

/**
 * Create partition table and materialized view for message statistics
 */
export function createChatPartition(chatId: number | bigint) {
  const tableName = getTableName(chatId)

  return sql`
    -- Create text search configuration if not exists
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'telegram_search'
      ) THEN
        CREATE TEXT SEARCH CONFIGURATION telegram_search (COPY = simple);
        ALTER TEXT SEARCH CONFIGURATION telegram_search ALTER MAPPING FOR word WITH simple;
      END IF;
    END $$;

    -- Create materialized view for message statistics
    CREATE MATERIALIZED VIEW IF NOT EXISTS message_stats_${sql.raw(tableName)} AS
    SELECT 
      chat_id,
      COUNT(*) as message_count,
      COUNT(*) FILTER (WHERE type = 'text') as text_count,
      COUNT(*) FILTER (WHERE type = 'photo') as photo_count,
      COUNT(*) FILTER (WHERE type = 'video') as video_count,
      COUNT(*) FILTER (WHERE type = 'document') as document_count,
      COUNT(*) FILTER (WHERE type = 'sticker') as sticker_count,
      COUNT(*) FILTER (WHERE type = 'other') as other_count,
      MAX(created_at) as last_message_date,
      (array_agg(content ORDER BY created_at DESC))[1] as last_message
    FROM ${sql.raw(tableName)}
    GROUP BY chat_id;

    -- Create unique index on chat_id for the materialized view
    CREATE UNIQUE INDEX IF NOT EXISTS message_stats_${sql.raw(tableName)}_chat_id_idx
    ON message_stats_${sql.raw(tableName)} (chat_id);
  `
}
