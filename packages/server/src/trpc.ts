import { initTRPC } from '@trpc/server'

// Create a new tRPC instance
export const t = initTRPC.create()

// Export reusable router and procedure helpers
export const router = t.router
export const publicProcedure = t.procedure
