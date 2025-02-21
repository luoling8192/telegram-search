import type { TelegramAdapter } from '@tg-search/core'

import { getConfig } from '@tg-search/common'
import { createAdapter } from '@tg-search/core'

let client: TelegramAdapter | undefined

/**
 * Get or create a singleton Telegram client instance
 * Ensures only one client connection is maintained throughout the application lifecycle
 */
export async function getTelegramClient(): Promise<TelegramAdapter> {
// Return existing client if already initialized
  if (client)
    return client

  // Create new client instance
  const config = getConfig()
  client = await createAdapter({
    type: 'client',
    apiId: Number(config.api.telegram.apiId),
    apiHash: config.api.telegram.apiHash,
    phoneNumber: config.api.telegram.phoneNumber,
  })

  return client
}
