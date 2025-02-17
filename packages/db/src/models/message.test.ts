import type { MessageType } from '../schema/types'

import { useDB } from '@tg-search/common'
import { describe, expect, it, vi } from 'vitest'

import {
  createMessage,
  findMessagesByChatId,
  findSimilarMessages,
  getMessageStats,
  refreshMessageStats,
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
    execute: vi.fn(() => [{ message_count: 1, text_count: 1 }]),
  },
}))

describe('message Model', () => {
  describe('createMessage', () => {
    it('should create a single message', async () => {
      const message = {
        id: 1,
        chatId: 1,
        type: 'text' as MessageType,
        content: 'test',
        createdAt: new Date(),
      }
      await createMessage(message)
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
      await createMessage(messages)
      expect(useDB().insert).toHaveBeenCalled()
    })

    it('should handle empty message array', async () => {
      await createMessage([])
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

  describe('refreshMessageStats', () => {
    it('should refresh message stats', async () => {
      await refreshMessageStats(1)
      expect(useDB().execute).toHaveBeenCalled()
    })
  })

  describe('getMessageStats', () => {
    it('should get message stats', async () => {
      const result = await getMessageStats(1)
      expect(result).toEqual({ message_count: 1, text_count: 1 })
      expect(useDB().execute).toHaveBeenCalled()
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
  })

  describe('findMessagesByChatId', () => {
    it('should find messages by chat ID', async () => {
      const result = await findMessagesByChatId(1)
      expect(result).toHaveLength(1)
      expect(useDB().select).toHaveBeenCalled()
    })
  })
})
