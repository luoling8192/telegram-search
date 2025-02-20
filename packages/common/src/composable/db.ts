import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { useLogger } from '../helper/logger'
import { getConfig, getDatabaseDSN } from './config'

let dbInstance: ReturnType<typeof drizzle>

export function initDB() {
  const logger = useLogger()
  logger.debug('Initializing database...')

  // Database connection
  const config = getConfig()
  const connectionString = getDatabaseDSN(config)
  const client = postgres(connectionString, {
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
