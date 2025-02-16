import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { getConfig } from './config'

let dbInstance: ReturnType<typeof drizzle>

export function initDB() {
  // Database connection
  const config = getConfig()
  const client = postgres(config.databaseUrl, {
    max: 1,
    onnotice: () => {},
  })

  dbInstance = drizzle(client)
}

export function useDB() {
  if (!dbInstance) {
    throw new Error('Database not initialized')
  }

  return dbInstance
}
