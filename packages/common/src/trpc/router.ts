import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, publicProcedure, errorMiddleware } from '.'
import {
  ChatSchema,
  FolderSchema,
  MessageSchema,
  SearchOptionsSchema,
} from './types'
import { observable } from '@trpc/server/observable'

// Helper to check context
const checkContext = (ctx: any) => {
  if (!ctx.telegram) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Telegram client not initialized',
    })
  }
  if (!ctx.db) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Database not initialized',
    })
  }
}

export const appRouter = router({
  // Chat related routes
  getChats: publicProcedure
    .use(errorMiddleware)
    .output(z.array(ChatSchema))
    .query(async ({ ctx }) => {
      checkContext(ctx)
      return await ctx.telegram.getChats()
    }),

  // Folder related routes
  getFolders: publicProcedure
    .use(errorMiddleware)
    .output(z.array(FolderSchema))
    .query(async ({ ctx }) => {
      checkContext(ctx)
      return await ctx.telegram.getFolders()
    }),

  // Message related routes
  getMessages: publicProcedure
    .use(errorMiddleware)
    .input(z.object({
      chatId: z.number(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }))
    .output(z.array(MessageSchema))
    .query(async ({ ctx, input }) => {
      checkContext(ctx)
      const messages: any[] = []
      
      // Use generator to get messages
      for await (const message of ctx.telegram.getMessages(input.chatId, input.limit, {
        skipMedia: true, // Skip media download for performance
      })) {
        messages.push(message)
        if (messages.length >= (input.limit || 100)) {
          break
        }
      }
      
      return messages
    }),

  // Search related routes
  search: publicProcedure
    .use(errorMiddleware)
    .input(SearchOptionsSchema)
    .output(z.array(MessageSchema))
    .query(async ({ ctx, input }) => {
      checkContext(ctx)
      
      // Use database to search messages
      const messages = await ctx.db.searchMessages({
        query: input.query,
        chatId: input.chatId,
        limit: input.limit || 100,
        offset: input.offset || 0,
        startTime: input.startTime,
        endTime: input.endTime,
        messageTypes: input.messageTypes,
      })
      
      return messages
    }),

  // Watch messages
  watchMessages: publicProcedure
    .use(errorMiddleware)
    .input(z.object({
      chatId: z.number().optional(),
    }))
    .subscription(({ ctx, input }) => {
      checkContext(ctx)
      
      return observable<any>((emit) => {
        // Setup message callback
        const callback = async (message: any) => {
          // Filter by chat ID if specified
          if (input.chatId && message.chatId !== input.chatId) {
            return
          }
          emit.next(message)
        }
        
        // Register callback
        ctx.telegram.onMessage(callback)
        
        // Cleanup on unsubscribe
        return () => {
          ctx.telegram.onMessage(() => {})
        }
      })
    }),
})

// Export type definition of API
export type AppRouter = typeof appRouter
