import { useLogger } from '@tg-search/common'

import { createExtensions } from './01-extensions'
import { createIndexes } from './02-indexes'
import { migrateMessageTables } from './03-message-tables'
import { createFunctions } from './04-functions'

/**
 * Run all migrations in order
 */
export async function runMigrations() {
  const logger = useLogger()
  const migrations = [
    { name: '01-extensions', run: createExtensions },
    { name: '02-indexes', run: createIndexes },
    { name: '03-message-tables', run: migrateMessageTables },
    { name: '04-functions', run: createFunctions },
  ]

  for (const { name, run } of migrations) {
    try {
      logger.log(`正在运行迁移: ${name}...`)
      await run()
      logger.log(`迁移 ${name} 完成`)
    }
    catch (error) {
      logger.withError(error).error(`迁移 ${name} 失败`)
      throw error
    }
  }
}
