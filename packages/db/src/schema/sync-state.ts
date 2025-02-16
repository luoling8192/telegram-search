import { sql } from 'drizzle-orm'
import { bigint, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

// Sync state table
export const syncState = pgTable('sync_state', {
  // UUID for external reference
  uuid: uuid('uuid').defaultRandom().primaryKey(),
  // Chat ID from Telegram
  chatId: bigint('chat_id', { mode: 'number' }).notNull().unique(),
  // Last synced message ID
  lastMessageId: bigint('last_message_id', { mode: 'number' }),
  // Last sync time
  lastSyncTime: timestamp('last_sync_time').notNull().defaultNow(),
}, table => [
  // Index for last_sync_time
  sql`CREATE INDEX IF NOT EXISTS sync_state_last_sync_time_idx ON ${table} (last_sync_time DESC)`,
])
