import { useDB } from '@tg-search/common'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { setupTest } from '../test/setup'
import {
  deleteAllChats,
  getAllChats,
  getChatCount,
  getChatMetadataById,
  getChatsInFolder,
  updateChat,
} from './chat'

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => [
          { id: 1, title: 'Chat 1', type: 'group' },
          { id: 2, title: 'Chat 2', type: 'channel' },
        ]),
        where: vi.fn(() => ({
          orderBy: vi.fn(() => [
            { id: 1, title: 'Chat 1', type: 'group' },
            { id: 2, title: 'Chat 2', type: 'channel' },
          ]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => [
          { id: 1, title: 'Chat 1', type: 'group' },
        ]),
      })),
    })),
    delete: vi.fn(() => ({
      from: vi.fn(() => true),
    })),
  },
}))

describe('chat Model', () => {
  beforeAll(async () => {
    setupTest()
  })
  describe('getChatById', () => {
    it('should get a chat by id', async () => {
      const result = await getChatMetadataById(1)
      expect(result).toHaveLength(1)
    })
  })
  describe('updateChat', () => {
    it('should update or create a chat', async () => {
      const chat = {
        id: 1,
        title: 'Chat 1',
        type: 'group' as const,
        messageCount: 100,
        lastSyncTime: new Date(),
      }
      const result = await updateChat(chat)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
      expect(useDB().insert).toHaveBeenCalled()
    })
  })

  describe('getAllChats', () => {
    it('should get all chats', async () => {
      const result = await getAllChats()
      expect(result).toHaveLength(2)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('getChatsInFolder', () => {
    it('should get chats in a folder', async () => {
      const result = await getChatsInFolder(1)
      expect(result).toHaveLength(2)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('getChatCount', () => {
    it('should get total chat count', async () => {
      const result = await getChatCount()
      expect(result).toBe(2)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('deleteAllChats', () => {
    it('should delete all chats', async () => {
      const result = await deleteAllChats()
      expect(result).toBe(true)
      expect(useDB().delete).toHaveBeenCalled()
    })
  })
})
