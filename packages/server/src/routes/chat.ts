import { getAllChats, getChatsInFolder } from '@tg-search/db'
import { Elysia, t } from 'elysia'

// Define response types
interface Chat {
  id: number
  title: string
  folder_id?: number
}

// Create chat routes
export const chatRoutes = new Elysia({ prefix: '/api/chat' })
  // Get all chats
  .get('/', async () => {
    const chats = await getAllChats()
    return { chats }
  }, {
    response: t.Object({
      chats: t.Array(t.Object({
        id: t.Number(),
        title: t.String(),
        folder_id: t.Optional(t.Number()),
      })),
    }),
  })
  // Get chats in a specific folder
  .get('/folder/:folderId', async ({ params: { folderId } }) => {
    const chats = await getChatsInFolder(Number(folderId))
    return { chats }
  }, {
    params: t.Object({
      folderId: t.String(),
    }),
    response: t.Object({
      chats: t.Array(t.Object({
        id: t.Number(),
        title: t.String(),
        folder_id: t.Optional(t.Number()),
      })),
    }),
  })
