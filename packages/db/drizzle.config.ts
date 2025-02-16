import process from 'node:process'
import { loadEnv } from '@tg-search/common'
import { defineConfig } from 'drizzle-kit'

// Load environment variables
loadEnv({
  required: ['DATABASE_URL'],
  throwIfMissing: true,
})

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/*',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
