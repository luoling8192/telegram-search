import type { SearchResult } from './types'

/**
 * Format message for display with time, content preview and similarity score
 */
export function formatSearchResult(result: SearchResult): string {
  const time = new Date(result.createdAt).toLocaleString()
  const content = result.content?.slice(0, 100) + (result.content?.length > 100 ? '...' : '')
  const similarity = result.similarity ? ` (相似度: ${(result.similarity * 100).toFixed(2)}%)` : ''
  return `[${time}]${similarity}\n${content}`
}

/**
 * Get folder choices for selection
 */
export function getFolderChoices(folders: Array<{ id: number, emoji?: string, title: string }>) {
  return folders.map(folder => ({
    name: `${folder.emoji || ''} ${folder.title}`,
    value: folder.id,
  }))
}

/**
 * Get chat choices for selection
 */
export function getChatChoices(chats: Array<{ id: number, type: string, title: string, messageCount: number }>) {
  return chats.map(chat => ({
    name: `[${chat.type}] ${chat.title} (${chat.messageCount} 条消息)`,
    value: chat.id,
  }))
}

/**
 * Get message type choices
 */
export function getMessageTypeChoices() {
  return [
    { name: '所有类型', value: undefined },
    { name: '文本消息', value: 'text' },
    { name: '图片', value: 'photo' },
    { name: '文档', value: 'document' },
    { name: '视频', value: 'video' },
    { name: '贴纸', value: 'sticker' },
    { name: '其他', value: 'other' },
  ]
}
