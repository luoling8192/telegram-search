import * as os from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { loadEnv } from '../helper/env'
import { useLogger } from '../helper/logger'

interface Config {
  botToken: string
  databaseUrl: string
  apiId: string
  apiHash: string
  phoneNumber: string
  openaiApiKey: string
  openaiApiBase?: string
  sessionPath: string
  mediaPath: string
}

let config: Config | null = null

/**
 * Resolve home directory in path
 */
function resolveHomeDir(dir: string): string {
  if (dir.startsWith('~/')) {
    return join(os.homedir(), dir.slice(2))
  }
  return dir
}

/**
 * Construct database URL from separate fields
 */
function constructDatabaseUrl({
  host,
  port,
  user,
  password,
  database,
}: {
  host: string
  port: string | number
  user: string
  password: string
  database: string
}): string {
  return `postgres://${user}:${password}@${host}:${port}/${database}`
}

export function initConfig() {
  const logger = useLogger()

  // Load environment variables
  loadEnv({
    required: ['BOT_TOKEN', 'API_ID', 'API_HASH', 'PHONE_NUMBER', 'OPENAI_API_KEY'],
    throwIfMissing: true,
  })

  // Get database URL from separate fields if not provided
  let databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    databaseUrl = constructDatabaseUrl({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'tg_search',
    })
  }

  // Get session and media paths with home directory resolution
  const defaultDir = join(os.homedir(), '.telegram-search')
  const sessionPath = resolveHomeDir(process.env.SESSION_PATH || join(defaultDir, 'session'))
  const mediaPath = resolveHomeDir(process.env.MEDIA_PATH || join(defaultDir, 'media'))

  config = {
    botToken: process.env.BOT_TOKEN!,
    databaseUrl,
    apiId: process.env.API_ID!,
    apiHash: process.env.API_HASH!,
    phoneNumber: process.env.PHONE_NUMBER!,
    openaiApiKey: process.env.OPENAI_API_KEY!,
    openaiApiBase: process.env.OPENAI_API_BASE,
    sessionPath,
    mediaPath,
  }

  logger.withFields({ config }).log('Config initialized')
}

export function getConfig(): Config {
  if (!config) {
    throw new Error('Config not initialized')
  }
  return config
}
