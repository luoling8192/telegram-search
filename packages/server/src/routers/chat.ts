import { getAllChats, getChatsInFolder } from '@tg-search/db'
import { z } from 'zod'

import { publicProcedure, router } from '../trpc'

export const chatRouter = router({
  // Get all chats
  list: publicProcedure.query(async () => {
    const chats = await getAllChats()
    return chats
  }),

  // Get chats in a specific folder
  listByFolder: publicProcedure
    .input(z.object({
      folderId: z.number(),
    }))
    .query(async ({ input }) => {
      const chats = await getChatsInFolder(input.folderId)
      return chats
    }),
})
