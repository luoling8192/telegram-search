import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { useLogger } from '../helper/logger'
import { getConfig } from './config'

let dbInstance: ReturnType<typeof drizzle>

export function initDB() {
  const logger = useLogger('db')
  logger.debug('Initializing database...')

  // Database connection
  const config = getConfig()
  if (!config.database.url) {
    throw new Error('Database URL is required')
  }
  const client = postgres(config.database.url, {
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
