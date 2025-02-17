import { chatRouter } from './routers/chat'
import { router } from './trpc'

// Create the root router
export const appRouter = router({
  chat: chatRouter,
})

// Export type definition of API
export type AppRouter = typeof appRouter
