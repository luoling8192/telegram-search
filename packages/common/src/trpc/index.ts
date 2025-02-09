import { initTRPC } from '@trpc/server'
import { ZodError } from 'zod'
import type { TRPCContext } from './context'

// Create a new tRPC instance with context
const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

// Export reusable router and procedure helpers
export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware

// Error handling middleware
export const errorMiddleware = middleware(async ({ path, type, next }) => {
  try {
    return await next()
  }
  catch (error) {
    // Log the error
    console.error(`Error in ${type} '${path}':`, error)
    throw error
  }
}) 
