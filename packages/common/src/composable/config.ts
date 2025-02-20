import type { Config } from '../types/config'

import * as fs from 'node:fs'
import * as os from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { merge } from 'lodash'
import * as yaml from 'yaml'

import { useLogger } from '../helper/logger'
import { findConfigDir, resolveHomeDir } from '../helper/path'

/**
 * Get database connection string from config
 */
export function getDatabaseDSN(config: Config): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

/**
 * Default configuration with detailed comments
 */
const DEFAULT_CONFIG = {
  // Database settings
  database: {
    // Default database connection settings
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'tg_search',
  },

  // Message settings
  message: {
    // Export settings
    export: {
      // Number of messages to fetch in each request
      batchSize: 200,
      // Number of concurrent requests
      concurrent: 3,
      // Number of retry attempts
      retryTimes: 3,
      // Number of retry attempts for takeout session (0 means infinite retries)
      maxTakeoutRetries: 3,
    },
    // Database batch settings
    batch: {
      // Number of messages to save in each batch
      size: 100,
    },
  },

  // Path settings
  path: {
    // Session storage path
    session: join(os.homedir(), '.telegram-search/session'),
    // Media storage path
    media: join(os.homedir(), '.telegram-search/media'),
  },

  // API settings
  api: {
    // Telegram API settings
    telegram: {
      // These values should be provided in config.yaml
      apiId: '',
      apiHash: '',
      phoneNumber: '',
    },
    // OpenAI API settings
    openai: {
      // API key should be provided in config.yaml
      apiKey: '',
      // Optional API base URL
      apiBase: 'https://api.openai.com/v1',
    },
  },
} as const satisfies Config

let config: Config | null = null

/**
 * Load YAML configuration file
 */
function loadYamlConfig(configPath: string): Partial<Config> {
  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    return yaml.parse(content)
  }
  catch {
    const logger = useLogger()
    logger.debug(`Failed to load config file: ${configPath}`)
    return {}
  }
}

/**
 * Validate required configuration fields
 */
function validateConfig(config: Config) {
  const required = [
    'api.telegram.apiId',
    'api.telegram.apiHash',
    'api.telegram.phoneNumber',
    'api.openai.apiKey',
  ] as const

  for (const path of required) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], config as any)
    if (!value) {
      throw new Error(`Missing required configuration: ${path}`)
    }
  }
}

export function initConfig() {
  if (config) {
    return
  }

  const logger = useLogger()

  try {
    // Find config directory
    const configDir = process.env.CONFIG_DIR || findConfigDir()
    logger.debug(`Using config directory: ${configDir}`)

    // Load environment-specific config first (if exists)
    const envConfig = process.env.NODE_ENV
      ? loadYamlConfig(join(configDir, `config.${process.env.NODE_ENV}.yaml`))
      : {}

    // Load main config
    const mainConfig = loadYamlConfig(join(configDir, 'config.yaml'))
    if (Object.keys(mainConfig).length === 0) {
      throw new Error('Main configuration file (config.yaml) not found or empty')
    }

    // Merge configurations with type assertion
    const mergedConfig = merge({}, DEFAULT_CONFIG, envConfig, mainConfig) as Config

    // Resolve paths
    mergedConfig.path.session = resolveHomeDir(mergedConfig.path.session)
    mergedConfig.path.media = resolveHomeDir(mergedConfig.path.media)

    // Construct database URL if not provided
    if (!mergedConfig.database.url) {
      const { host, port, user, password, database } = mergedConfig.database
      mergedConfig.database.url = `postgres://${user}:${password}@${host}:${port}/${database}`
    }

    // Log merged config
    logger.withFields({ mergedConfig: JSON.stringify(mergedConfig) }).debug('Config initialized successfully')

    // Validate configuration
    validateConfig(mergedConfig)

    // Set global config
    config = mergedConfig

    logger.debug('Config initialized successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize config')
    throw error
  }
}

export function getConfig(): Config {
  if (!config) {
    initConfig()
  }

  return config as Config
}
