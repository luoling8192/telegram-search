import { initTRPC } from '@trpc/server'
import superjson from 'superjson'

// Initialize tRPC instance with context
export interface Context {
  // Add your context properties here
  // For example: user: User | null;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape
  },
})

// Export reusable router and procedure helpers
export const router = t.router
export const publicProcedure = t.procedure

// Export types
export type Router = typeof router
export type Procedure = typeof publicProcedure
