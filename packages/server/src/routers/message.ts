import { z } from 'zod'
import { findMessagesByChatId } from '@tg-search/db/src/models/message'
import { publicProcedure, router } from '../trpc'

// Message router for handling message-related operations
export const messageRouter = router({
  // Get all messages for a specific chat
  list: publicProcedure
    .input(z.object({
      chatId: z.number(),
    }))
    .query(async ({ input }) => {
      const messages = await findMessagesByChatId(input.chatId)
      return messages
    }),
}) 
