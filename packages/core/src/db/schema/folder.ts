import { sql } from 'drizzle-orm'
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Folders table
export const folders = pgTable('folders', {
  // UUID for external reference
  uuid: uuid('uuid').defaultRandom().primaryKey(),
  // Folder ID from Telegram
  id: integer('id').notNull().unique(),
  // Folder title
  title: text('title').notNull(),
  // Folder emoji
  emoji: text('emoji'),
  // Last sync time
  lastSyncTime: timestamp('last_sync_time').notNull().defaultNow(),
}, table => [
  // Index for last_sync_time
  sql`CREATE INDEX IF NOT EXISTS folders_last_sync_time_idx ON ${table} (last_sync_time DESC)`,
])
