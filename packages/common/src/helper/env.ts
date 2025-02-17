import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

import { useLogger } from './logger'

/**
 * Find .env file path from command line arguments or project root
 */
function findEnvPath(): string | undefined {
  // Try to load .env file from command line arguments
  let envPath: string | undefined

  // Check -e flag
  const envIndex = process.argv.indexOf('-e')
  if (envIndex !== -1 && envIndex + 1 < process.argv.length) {
    envPath = process.argv[envIndex + 1]
  }
  else {
    // Check --env= flag
    const envFlagIndex = process.argv.findIndex(arg => arg.startsWith('--env='))
    if (envFlagIndex !== -1) {
      envPath = process.argv[envFlagIndex].split('=')[1]
    }
  }

  // If no env path provided, try to find .env in project root
  if (!envPath) {
    // Try to find .env in project root by looking for pnpm-workspace.yaml
    const currentFile = fileURLToPath(import.meta.url)
    let currentPath = dirname(currentFile)
    while (currentPath !== dirname(currentPath)) {
      if (existsSync(join(currentPath, 'pnpm-workspace.yaml'))) {
        envPath = join(currentPath, '.env')
        break
      }
      currentPath = dirname(currentPath)
    }
  }

  return envPath
}

/**
 * Load environment variables from .env file
 */
export function loadEnv(options: {
  /** Required environment variables */
  required?: string[]
  /** Whether to throw error if .env file not found */
  throwIfNotFound?: boolean
  /** Whether to throw error if required variables not found */
  throwIfMissing?: boolean
} = {}): string | undefined {
  const logger = useLogger('env')

  const {
    required = [],
    throwIfNotFound = false,
    throwIfMissing = true,
  } = options

  // Find .env file
  const envPath = findEnvPath()

  // Load .env file if found
  if (envPath && existsSync(envPath)) {
    logger.withFields({ envPath }).debug('Loading .env')
    dotenv.config({ path: envPath })

    // Check required variables
    const missing = required.filter(key => !process.env[key])
    if (missing.length > 0) {
      const error = `Missing required environment variables: ${missing.join(', ')}`
      if (throwIfMissing)
        throw new Error(error)
      else
        logger.warn(error)
    }

    return envPath
  }
  else {
    // Fallback to process.env
    logger.warn('No .env file found, falling back to process.env')
    dotenv.config()

    // Check required variables
    const missing = required.filter(key => !process.env[key])
    if (missing.length > 0) {
      const error = `Missing required environment variables: ${missing.join(', ')}`
      if (throwIfMissing)
        throw new Error(error)
      else
        logger.warn(error)
    }

    if (throwIfNotFound)
      throw new Error('No .env file found')

    return undefined
  }
}
