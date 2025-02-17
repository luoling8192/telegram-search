import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAllChats, getChatsInFolder } from '@tg-search/db'
import { appRouter } from '../../index'
import { createCaller } from '../../trpc'

// Mock the database functions
vi.mock('@tg-search/db', () => ({
  getAllChats: vi.fn(),
  getChatsInFolder: vi.fn(),
}))

describe('Chat Router', () => {
  const caller = createCaller()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('should return all chats', async () => {
      // Mock data
      const mockChats = [
        {
          id: 1,
          title: 'Chat 1',
          type: 'private',
          username: 'user1',
          lastMessage: 'Hello',
          lastMessageDate: new Date(),
          lastSyncTime: new Date(),
          messageCount: 10,
          folderId: 1,
        },
        {
          id: 2,
          title: 'Chat 2',
          type: 'group',
          username: 'group1',
          lastMessage: 'Hi',
          lastMessageDate: new Date(),
          lastSyncTime: new Date(),
          messageCount: 20,
          folderId: 1,
        },
      ]

      // Setup mock
      vi.mocked(getAllChats).mockResolvedValue(mockChats)

      // Execute
      const result = await caller.chat.list()

      // Verify
      expect(getAllChats).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockChats)
    })

    it('should handle empty result', async () => {
      // Setup mock
      vi.mocked(getAllChats).mockResolvedValue([])

      // Execute
      const result = await caller.chat.list()

      // Verify
      expect(getAllChats).toHaveBeenCalledTimes(1)
      expect(result).toEqual([])
    })
  })

  describe('listByFolder', () => {
    it('should return chats in specified folder', async () => {
      // Mock data
      const folderId = 1
      const mockChats = [
        {
          id: 1,
          title: 'Chat 1',
          type: 'private',
          username: 'user1',
          lastMessage: 'Hello',
          lastMessageDate: new Date(),
          lastSyncTime: new Date(),
          messageCount: 10,
          folderId,
        },
      ]

      // Setup mock
      vi.mocked(getChatsInFolder).mockResolvedValue(mockChats)

      // Execute
      const result = await caller.chat.listByFolder({ folderId })

      // Verify
      expect(getChatsInFolder).toHaveBeenCalledWith(folderId)
      expect(result).toEqual(mockChats)
    })

    it('should handle empty folder', async () => {
      // Setup mock
      vi.mocked(getChatsInFolder).mockResolvedValue([])

      // Execute
      const result = await caller.chat.listByFolder({ folderId: 1 })

      // Verify
      expect(getChatsInFolder).toHaveBeenCalledWith(1)
      expect(result).toEqual([])
    })
  })
}) 
