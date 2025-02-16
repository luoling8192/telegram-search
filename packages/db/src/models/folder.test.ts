import { useDB } from '@tg-search/common'
import { describe, expect, it, vi } from 'vitest'

import {
  deleteAllFolders,
  getAllFolders,
  getFolderCount,
  updateFolder,
} from './folder'

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => [
        { id: 1, title: 'Folder 1', emoji: '📁' },
        { id: 2, title: 'Folder 2', emoji: '📂' },
      ]),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => [
          { id: 1, title: 'Folder 1', emoji: '📁' },
        ]),
      })),
    })),
    delete: vi.fn(() => ({
      from: vi.fn(() => true),
    })),
  },
}))

describe('folder Model', () => {
  describe('updateFolder', () => {
    it('should update or create a folder', async () => {
      const folder = {
        id: 1,
        title: 'Folder 1',
        emoji: '📁',
      }
      const result = await updateFolder(folder)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
      expect(useDB().insert).toHaveBeenCalled()
    })
  })

  describe('getAllFolders', () => {
    it('should get all folders', async () => {
      const result = await getAllFolders()
      expect(result).toHaveLength(2)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('getFolderCount', () => {
    it('should get total folder count', async () => {
      const result = await getFolderCount()
      expect(result).toBe(2)
      expect(useDB().select).toHaveBeenCalled()
    })
  })

  describe('deleteAllFolders', () => {
    it('should delete all folders', async () => {
      const result = await deleteAllFolders()
      expect(result).toBe(true)
      expect(useDB().delete).toHaveBeenCalled()
    })
  })
})
