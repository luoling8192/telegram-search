import type { MessageType } from '../schema/types'

import { useDB } from '@tg-search/common'
import { describe, expect, it, vi } from 'vitest'

import {
  createMessage,
  findSimilarMessages,
  getLastMessageId,
  getMessageById,
  getMessageCount,
  getPartitionTables,
  searchMessages,
} from './message'
import { getMessagesWithoutEmbedding } from './message-content'

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => [{ id: 1, content: 'test' }]),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => [{ id: 1 }]),
          })),
          groupBy: vi.fn(() => [
            { tableName: 'messages_1', chatId: 1 },
            { tableName: 'messages_2', chatId: 2 },
          ]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => [{ id: 1, content: 'test' }]),
        })),
      })),
    })),
  },
}))

describe('message Model', () => {
  describe('searchMessages', () => {
    it('should search messages with text query', async () => {
      const result = await searchMessages('test', 10)
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('getMessageById', () => {
    it('should get message by ID', async () => {
      const result = await getMessageById(1)
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('createMessage', () => {
    it('should create a single message', async () => {
      const message = {
        id: 1,
        chatId: 1,
        type: 'text' as MessageType,
        content: 'test',
        createdAt: new Date(),
      }
      const result = await createMessage(message)
      expect(result).toHaveLength(1)
      expect(useDB().insert).toHaveBeenCalled()
    })

    it('should create multiple messages', async () => {
      const messages = [
        {
          id: 1,
          chatId: 1,
          type: 'text' as MessageType,
          content: 'test1',
          createdAt: new Date(),
        },
        {
          id: 2,
          chatId: 1,
          type: 'text' as MessageType,
          content: 'test2',
          createdAt: new Date(),
        },
      ]
      const result = await createMessage(messages)
      expect(result).toHaveLength(1) // Mock returns single item
      expect(useDB().insert).toHaveBeenCalled()
    })

    it('should handle empty message array', async () => {
      const result = await createMessage([])
      expect(result).toHaveLength(0)
      expect(useDB().insert).not.toHaveBeenCalled()
    })
  })

  describe('getMessagesWithoutEmbedding', () => {
    it('should get messages without embedding', async () => {
      const result = await getMessagesWithoutEmbedding(1, 10)
      expect(result).toHaveLength(1)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('getMessageCount', () => {
    it('should get total message count', async () => {
      const result = await getMessageCount()
      expect(result).toBe(1)
      expect(useDB().select).toHaveBeenCalled()
    })

    it('should get message count for specific chat', async () => {
      const result = await getMessageCount(1)
      expect(result).toBe(1)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('getLastMessageId', () => {
    it('should get last message ID for chat', async () => {
      const result = await getLastMessageId(1)
      expect(result).toBe(1)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('getPartitionTables', () => {
    it('should get all partition tables', async () => {
      const result = await getPartitionTables()
      expect(result).toHaveLength(2)
      expect(useDB().select).toHaveBeenCalled()
    })

    it('should get partition tables for specific chat', async () => {
      const result = await getPartitionTables(1)
      expect(result).toHaveLength(2)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('findSimilarMessages', () => {
    it('should find similar messages', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const options = {
        chatId: 1,
        type: 'text' as MessageType,
        limit: 10,
      }
      const result = await findSimilarMessages(embedding, options)
      expect(result).toHaveLength(1)
      expect(useDB().select).toHaveBeenCalled()
    })

    it('should handle empty options', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const result = await findSimilarMessages(embedding)
      expect(result).toHaveLength(1)
      expect(useDB().select).toHaveBeenCalled()
    })
  })
})
