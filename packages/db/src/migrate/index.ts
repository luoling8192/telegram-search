import { dirname } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getConfig, getDatabaseDSN, initConfig, initDB, initLogger, useLogger } from '@tg-search/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { runMigrations } from './migrations'

// Run migrations
async function main() {
  initLogger()
  const logger = useLogger()
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  // Initialize config
  initConfig()
  const config = getConfig()
  initDB()
  logger.log('正在运行数据库迁移...')

  try {
    // Run Drizzle migrations
    logger.log('正在运行 Drizzle 迁移...')
    const connectionString = getDatabaseDSN(config)
    const migrationClient = postgres(connectionString, { max: 1 })
    const db = drizzle(migrationClient)
    await migrate(db, { migrationsFolder: './drizzle' })
    await migrationClient.end()
    logger.log('Drizzle 迁移完成')

    // Run custom migrations
    await runMigrations()

    process.exit(0)
  }
  catch (error) {
    logger.withError(error).error('数据库迁移失败')
    process.exit(1)
  }
}

main()
