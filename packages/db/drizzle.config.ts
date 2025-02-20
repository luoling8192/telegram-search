import { getConfig, getDatabaseDSN, initConfig, initLogger } from '@tg-search/common'
import { defineConfig } from 'drizzle-kit'

initLogger()
initConfig()
const config = getConfig()

export default defineConfig({
  schema: './src/schema/*',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseDSN(config),
  },
})
