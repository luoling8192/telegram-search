import type { MediaInfo } from './types'

import { tsvector, vector } from '@tg-search/pg-vector'
import { sql } from 'drizzle-orm'
import { bigint, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { messageTypeEnum } from './types'

// Message content table template
export function createMessageContentTable(chatId: number | bigint) {
  // 使用 n 前缀表示负数，处理 BigInt
  const absId = chatId < 0 ? -chatId : chatId
  const tableName = `messages_${chatId < 0 ? 'n' : ''}${absId}`
  return pgTable(tableName, {
    // UUID for external reference
    uuid: uuid('uuid').defaultRandom().primaryKey(),
    // Message ID from Telegram
    id: bigint('id', { mode: 'number' }).notNull(),
    // Chat ID from Telegram
    chatId: bigint('chat_id', { mode: 'number' }).notNull(),
    // Message type
    type: messageTypeEnum('type').notNull().default('text'),
    // Message content
    content: text('content'),
    // Message vector embedding (1536 dimensions)
    embedding: vector('embedding'),
    // Full-text search vector
    tsContent: tsvector('ts_content').notNull().$defaultFn(() => sql`to_tsvector('telegram_search', coalesce(content, ''))`),
    // Media file info
    mediaInfo: jsonb('media_info').$type<MediaInfo>(),
    // Creation time
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // From user ID
    fromId: bigint('from_id', { mode: 'number' }),
    // From user name
    fromName: text('from_name'),
    // From user avatar
    fromAvatar: jsonb('from_avatar').$type<{
      type: 'photo' | 'emoji'
      value: string // 如果是 photo 则是 URL，如果是 emoji 则是表情符号
      color?: string // emoji 背景色
    }>(),
    // Reply to message ID
    replyToId: bigint('reply_to_id', { mode: 'number' }),
    // Forward from chat ID
    forwardFromChatId: bigint('forward_from_chat_id', { mode: 'number' }),
    // Forward from chat name
    forwardFromChatName: text('forward_from_chat_name'),
    // Forward from message ID
    forwardFromMessageId: bigint('forward_from_message_id', { mode: 'number' }),
    // Views count
    views: integer('views'),
    // Forwards count
    forwards: integer('forwards'),
    // Links in message
    links: jsonb('links').$type<string[]>(),
    // Message metadata
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  }, table => [
    // Unique constraint for chat_id and id
    sql`UNIQUE (chat_id, id)`,
    // Index for vector similarity search
    sql`CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_embedding_idx
      ON ${table}
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)`,
    // Index for full-text search
    sql`CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_ts_content_idx
      ON ${table}
      USING GIN (ts_content)`,
    // Index for created_at
    sql`CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_created_at_idx ON ${table} (created_at DESC)`,
    // Index for type
    sql`CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_type_idx ON ${table} (type)`,
    // Index for id
    sql`CREATE UNIQUE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_id_idx ON ${table} (id)`,
  ])
}

// Function to create partition table for a chat
export function createChatPartition(chatId: number | bigint) {
  // 使用 n 前缀表示负数，处理 BigInt
  const absId = chatId < 0 ? -chatId : chatId
  const tableName = `messages_${chatId < 0 ? 'n' : ''}${absId}`
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

    CREATE TABLE IF NOT EXISTS ${sql.raw(tableName)} (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id BIGINT NOT NULL,
      chat_id BIGINT NOT NULL,
      type message_type NOT NULL DEFAULT 'text',
      content TEXT,
      embedding vector(1536),
      media_info JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
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
      metadata JSONB,
      -- Add full-text search column
      ts_content tsvector GENERATED ALWAYS AS (to_tsvector('telegram_search', coalesce(content, ''))) STORED,
      UNIQUE (chat_id, id),
      UNIQUE (id)
    );

    -- Create full-text search index
    CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_ts_content_idx
    ON ${sql.raw(tableName)} USING GIN (ts_content);

    -- Create vector similarity index
    CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_embedding_idx
    ON ${sql.raw(tableName)}
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

    -- Create timestamp index
    CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_created_at_idx
    ON ${sql.raw(tableName)} (created_at DESC);

    -- Create type index
    CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_type_idx
    ON ${sql.raw(tableName)} (type);

    -- Create unique ID index
    CREATE UNIQUE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_id_idx
    ON ${sql.raw(tableName)} (id);

    -- Create materialized view for message stats
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

    -- Create index on materialized view
    CREATE UNIQUE INDEX IF NOT EXISTS message_stats_${sql.raw(tableName)}_chat_id_idx
    ON message_stats_${sql.raw(tableName)} (chat_id);
  `
}
