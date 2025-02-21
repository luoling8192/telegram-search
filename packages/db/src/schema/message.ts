import type { ColumnBaseConfig, ColumnDataType } from 'drizzle-orm'
import type { PgColumn, PgColumnBuilderBase } from 'drizzle-orm/pg-core'
import type { MediaInfo } from './types'

import { vector } from '@tg-search/pg-vector'
import { sql } from 'drizzle-orm'
import { bigint, customType, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { messageTypeEnum } from './types'

/**
 * Creates a table name for a chat partition
 */
function getTableName(chatId: number | bigint): string {
  const absId = chatId < 0 ? -chatId : chatId
  return `messages_${chatId < 0 ? 'n' : ''}${absId}`
}

// TSVector column data
export interface TSVectorColumnData extends PgColumn<ColumnBaseConfig<ColumnDataType, string>, object, object> {
  dataType: ColumnDataType
  baseType: string
}

// TSVector column builder
export type TSVectorColumnBuilder = PgColumnBuilderBase<{
  name: string
  dataType: ColumnDataType
  enumValues: string[]
  data: TSVectorColumnData
  driverParam: string
  columnType: 'tsvector'
}>

/**
 * Creates a tsvector column for full text search
 * @param name Column name
 * @returns TSVector column builder
 */
export function tsvector(name: string) {
  return customType<{ data: string }>({
    dataType: () => 'tsvector',
  })(name)
}

/**
 * Common table schema for message content
 */
const messageTableSchema = {
  uuid: uuid('uuid').defaultRandom().primaryKey(),
  id: bigint('id', { mode: 'number' }).notNull(),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  type: messageTypeEnum('type').notNull().default('text'),
  content: text('content'),
  embedding: vector('embedding'),
  // Note: tsContent still needs sql template since there's no direct drizzle equivalent
  tsContent: tsvector('ts_content').notNull().$defaultFn(() =>
    sql`to_tsvector('telegram_search', coalesce(content, ''))`,
  ),
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
 * Creates table indexes
 * Note: Some indexes still need raw SQL due to specialized PostgreSQL features
 */
function createTableIndexes(tableName: string, table: any) {
  return [
    // Composite unique constraint
    { name: `${tableName}_chat_id_id_unique`, columns: ['chat_id', 'id'], unique: true },

    // Vector similarity search index - needs raw SQL
    sql`CREATE INDEX IF NOT EXISTS ${sql.raw(tableName)}_embedding_idx 
      ON ${table} 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)`,

    // Full text search index - needs raw SQL
    sql`CREATE INDEX IF NOT EXISTS ${sql.raw(tableName)}_ts_content_idx
      ON ${table}
      USING GIN (ts_content)`,

    // Regular indexes
    { name: `${tableName}_created_at_idx`, columns: ['created_at'], desc: true },
    { name: `${tableName}_type_idx`, columns: ['type'] },
    { name: `${tableName}_id_idx`, columns: ['id'], unique: true },
  ]
}

/**
 * Creates a message content table for a specific chat
 */
export function createMessageContentTable(chatId: number | bigint) {
  const tableName = getTableName(chatId)
  return pgTable(tableName, messageTableSchema, table => createTableIndexes(tableName, table))
}

/**
 * Creates a partition table and materialized view for a chat
 * Note: This still needs raw SQL due to materialized view functionality
 */
export function createChatPartition(chatId: number | bigint) {
  const tableName = getTableName(chatId)

  return sql`
    -- Create text search configuration
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'telegram_search'
      ) THEN
        CREATE TEXT SEARCH CONFIGURATION telegram_search (COPY = simple);
        ALTER TEXT SEARCH CONFIGURATION telegram_search ALTER MAPPING FOR word WITH simple;
      END IF;
    END $$;

    -- Create materialized view
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

    CREATE UNIQUE INDEX IF NOT EXISTS message_stats_${sql.raw(tableName)}_chat_id_idx
    ON message_stats_${sql.raw(tableName)} (chat_id);
  `
}
