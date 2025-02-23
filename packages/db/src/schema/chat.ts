import { sql } from 'drizzle-orm'
import { bigint, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { databaseChatTypeEnum } from './types'

// Chats table
export const chats = pgTable('chats', {
  // UUID for external reference
  uuid: uuid('uuid').defaultRandom().primaryKey(),
  // Chat ID from Telegram
  id: bigint('id', { mode: 'number' }).notNull().unique(),
  // Chat type
  type: databaseChatTypeEnum('type').notNull(),
  // Chat title
  title: text('title').notNull(),
  // Last message
  lastMessage: text('last_message'),
  // Last message date
  lastMessageDate: timestamp('last_message_date'),
  // Last sync time
  lastSyncTime: timestamp('last_sync_time').notNull().defaultNow(),
  // Message count
  messageCount: integer('message_count').notNull().default(0),
  // Folder ID
  folderId: integer('folder_id'),
}, table => [
  // Index for type
  sql`CREATE INDEX IF NOT EXISTS chats_type_idx ON ${table} (type)`,
  // Index for last_sync_time
  sql`CREATE INDEX IF NOT EXISTS chats_last_sync_time_idx ON ${table} (last_sync_time DESC)`,
  // Index for folder_id
  sql`CREATE INDEX IF NOT EXISTS chats_folder_id_idx ON ${table} (folder_id)`,
  // Index for last_message_date
  sql`CREATE INDEX IF NOT EXISTS chats_last_message_date_idx ON ${table} (last_message_date DESC)`,
])
