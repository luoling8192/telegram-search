import type { MediaInfo } from './types'

import { sql } from 'drizzle-orm'
import { bigint, customType, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { messageTypeEnum } from './types'

// Base messages table (metadata only)
export const messages = pgTable('messages', {
  // UUID for external reference
  uuid: uuid('uuid').defaultRandom().primaryKey(),
  // Message ID from Telegram
  id: bigint('id', { mode: 'number' }).notNull(),
  // Chat ID from Telegram
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  // Message type
  type: messageTypeEnum('type').notNull().default('text'),
  // Creation time
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // Partition table name
  partitionTable: text('partition_table').notNull(),
}, table => [
  // Unique constraint for chat_id and id
  sql`UNIQUE (chat_id, id)`,
  // Index for created_at
  sql`CREATE INDEX IF NOT EXISTS messages_created_at_idx ON ${table} (created_at DESC)`,
  // Index for type
  sql`CREATE INDEX IF NOT EXISTS messages_type_idx ON ${table} (type)`,
  // Index for chat_id and created_at
  sql`CREATE INDEX IF NOT EXISTS messages_chat_id_created_at_idx ON ${table} (chat_id, created_at DESC)`,
])

// Vector type
const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(1536)'
  },
})

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
    // Media file info
    mediaInfo: jsonb('media_info').$type<MediaInfo>(),
    // Creation time
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // From user ID
    fromId: bigint('from_id', { mode: 'number' }),
    // Reply to message ID
    replyToId: bigint('reply_to_id', { mode: 'number' }),
    // Forward from chat ID
    forwardFromChatId: bigint('forward_from_chat_id', { mode: 'number' }),
    // Forward from message ID
    forwardFromMessageId: bigint('forward_from_message_id', { mode: 'number' }),
    // Views count
    views: integer('views'),
    // Forwards count
    forwards: integer('forwards'),
  }, table => [
    // Unique constraint for chat_id and id
    sql`UNIQUE (chat_id, id)`,
    // Index for vector similarity search
    sql`CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_embedding_idx
      ON ${table}
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)`,
    // Index for created_at
    sql`CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_created_at_idx ON ${table} (created_at DESC)`,
    // Index for type
    sql`CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_type_idx ON ${table} (type)`,
  ])
}

// Function to create partition table for a chat
export function createChatPartition(chatId: number | bigint) {
  // 使用 n 前缀表示负数，处理 BigInt
  const absId = chatId < 0 ? -chatId : chatId
  const tableName = `messages_${chatId < 0 ? 'n' : ''}${absId}`
  return sql`
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
      reply_to_id BIGINT,
      forward_from_chat_id BIGINT,
      forward_from_message_id BIGINT,
      views INTEGER,
      forwards INTEGER,
      UNIQUE (chat_id, id)
    );

    CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_embedding_idx
    ON ${sql.raw(tableName)}
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

    CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_created_at_idx
    ON ${sql.raw(tableName)} (created_at DESC);

    CREATE INDEX IF NOT EXISTS messages_${sql.raw(chatId < 0 ? 'n' : '')}${sql.raw(String(absId))}_type_idx
    ON ${sql.raw(tableName)} (type);
  `
}
