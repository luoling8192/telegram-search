import { initTRPC } from '@trpc/server'

import { appRouter } from './index'

// Create a new tRPC instance
const t = initTRPC.create()

// Export reusable router and procedure helpers
export const router = t.router
export const publicProcedure = t.procedure

// Create a caller for testing
export function createCaller() {
  return appRouter.createCaller({})
}
