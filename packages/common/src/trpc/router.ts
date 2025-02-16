import { initTRPC } from '@trpc/server'

// import { channelRouter } from './routes/channel'
// import { messageRouter } from './routes/message'

const t = initTRPC.create()

export const appRouter = t.router({
  // message: messageRouter,
  // channel: channelRouter,
})

export type AppRouter = typeof appRouter

// Export type helper
export interface RouterInput {
  message: {
    search: {
      query: string
      limit?: number
      offset?: number
      channelId?: number
    }
    getById: number
  }
  channel: {
    list: {
      limit?: number
      offset?: number
    }
    getById: number
    stats: number
  }
}
