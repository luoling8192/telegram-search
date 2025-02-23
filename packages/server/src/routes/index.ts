import type { App } from 'h3'

import { setupAuthRoutes } from './auth'
import { setupChatRoutes } from './chat'
import { setupCommandRoutes } from './commands'
import { setupConfigRoutes } from './config'
import { setupMessageRoutes } from './message'
import { setupSearchRoutes } from './search'

/**
 * Setup all routes for the application
 */
export function setupRoutes(app: App) {
  setupAuthRoutes(app)
  setupChatRoutes(app)
  setupCommandRoutes(app)
  setupConfigRoutes(app)
  setupMessageRoutes(app)
  setupSearchRoutes(app)
}
