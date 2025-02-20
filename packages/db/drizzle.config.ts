import process from 'node:process'
import { getConfig, initConfig } from '@tg-search/common'
import { defineConfig } from 'drizzle-kit'

// Initialize config
initConfig()
const config = getConfig()

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/*',
  out: './drizzle',
  dbCredentials: {
    url: config.database.url!,
  },
})
