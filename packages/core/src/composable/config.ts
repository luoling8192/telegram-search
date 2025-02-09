import process from 'node:process'
import { useLogger } from '@tg-search/common'
import { config as dotenvConfig } from 'dotenv'

interface Config {
  botToken: string
  databaseUrl: string
  apiId: string
  apiHash: string
  phoneNumber: string
  openaiApiKey: string
  openaiApiBase?: string
  sessionFile: string
  mediaDir: string
}

let config: Config | null = null

export function initConfig() {
  dotenvConfig()

  config = {
    botToken: process.env.BOT_TOKEN!,
    databaseUrl: process.env.DATABASE_URL!,
    apiId: process.env.API_ID!,
    apiHash: process.env.API_HASH!,
    phoneNumber: process.env.PHONE_NUMBER!,
    openaiApiKey: process.env.OPENAI_API_KEY!,
    openaiApiBase: process.env.OPENAI_API_BASE,
    sessionFile: process.env.SESSION_FILE || `${process.env.HOME}/.telegram-search/session`,
    mediaDir: process.env.MEDIA_DIR || `${process.env.HOME}/.telegram-search/media`,
  }

  useLogger().withFields({ config }).log('Config initialized')
}

export function getConfig(): Config {
  if (!config) {
    throw new Error('Config not initialized')
  }
  return config
}
