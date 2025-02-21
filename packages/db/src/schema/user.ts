import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * User table for caching user information from Telegram
 */
export const userTable = pgTable('users', {
  // UUID for internal use
  uuid: uuid('uuid').defaultRandom().primaryKey(),
  // User ID from Telegram
  id: bigint('id', { mode: 'number' }).notNull().unique(),
  // Username (optional)
  username: text('username'),
  // Display name (required)
  displayName: text('display_name').notNull(),
  // Avatar information (optional)
  avatar: jsonb('avatar').$type<{
    type: 'photo' | 'emoji'
    value: string // base64 encoded photo or emoji
    color?: string // emoji background color
  }>(),
  // Last update time
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  // Index on user ID for faster lookups
  index('user_id_idx').on(table.id),
  // Index on username for faster lookups
  index('user_username_idx').on(table.username),
  // Index on update time for cleanup
  index('user_updated_at_idx').on(table.updatedAt),
])
