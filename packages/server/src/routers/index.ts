import { router } from '../trpc'
import { messageRouter } from './message'

// Root router with all sub-routers
export const appRouter = router({
  message: messageRouter,
})

// Export type definition of API
export type AppRouter = typeof appRouter
