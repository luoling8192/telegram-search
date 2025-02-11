import type { ClientAdapter } from '../adapter/client'
import type { SearchOptions } from '../db'
import type { MessageType } from '../db/schema/message'

import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'

import { createAdapter } from '../adapter/factory'
import { getConfig } from '../composable/config'
import { findSimilarMessages, getAllChats, getAllFolders, getChatsInFolder } from '../db'
import { EmbeddingService } from '../services/embedding'

const logger = useLogger()

/**
 * Format message for display
 */
function formatMessage(message: any) {
  const time = new Date(message.createdAt).toLocaleString()
  const content = message.content?.slice(0, 100) + (message.content?.length > 100 ? '...' : '')
  const similarity = message.similarity ? ` (相似度: ${(message.similarity * 100).toFixed(2)}%)` : ''
  return `[${time}]${similarity}\n${content}`
}

/**
 * Get search options from user
 */
async function getSearchOptions(): Promise<SearchOptions> {
  const options: SearchOptions = {}

  // Get message type
  const includeType = await input.confirm({
    message: '是否按消息类型过滤？',
    default: false,
  })

  if (includeType) {
    const type = await input.select<MessageType>({
      message: '请选择消息类型：',
      choices: [
        { name: '文本', value: 'text' },
        { name: '图片', value: 'photo' },
        { name: '视频', value: 'video' },
        { name: '文件', value: 'document' },
        { name: '贴纸', value: 'sticker' },
        { name: '其他', value: 'other' },
      ],
    })
    options.type = type
  }

  // Get time range
  const includeTimeRange = await input.confirm({
    message: '是否按时间范围过滤？',
    default: false,
  })

  if (includeTimeRange) {
    const startTime = await input.input({
      message: '请输入开始时间（YYYY-MM-DD）：',
      default: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })
    options.startTime = new Date(startTime)

    const endTime = await input.input({
      message: '请输入结束时间（YYYY-MM-DD）：',
      default: new Date().toISOString().split('T')[0],
    })
    options.endTime = new Date(endTime)
  }

  // Get limit
  const limit = await input.input({
    message: '请输入返回结果数量：',
    default: '10',
  })
  options.limit = Number(limit)

  return options
}

async function searchMessages(adapter: ClientAdapter) {
  // 获取所有文件夹
  const folders = await getAllFolders()
  const folderChoices = [
    { name: '全部会话', value: 0 },
    ...folders.map(folder => ({
      name: `${folder.emoji || ''} ${folder.title}`,
      value: folder.id,
    })),
  ]

  // 让用户选择文件夹
  const folderId = await input.select({
    message: '请选择要搜索的文件夹：',
    choices: folderChoices,
  })

  // 获取文件夹中的会话
  const chats = folderId === 0 ? await getAllChats() : await getChatsInFolder(Number(folderId))
  if (chats.length === 0) {
    logger.log('所选文件夹中没有任何会话')
    return
  }

  // 让用户选择会话
  const chatChoices = [
    { name: '所有会话', value: 0 },
    ...chats.map(chat => ({
      name: `[${chat.type}] ${chat.name} (${chat.messageCount} 条消息，最后更新: ${chat.lastMessageDate?.toLocaleString() || '从未'})`,
      value: chat.id,
    })),
  ]

  const chatId = await input.select({
    message: '请选择要搜索的会话：',
    choices: chatChoices,
  })

  // Get search query
  const query = await input.input({
    message: '请输入搜索关键词：',
  })

  // Get search options
  const options = await getSearchOptions()
  if (chatId !== 0) {
    options.chatId = Number(chatId)
  }

  // Generate embedding for query
  const embeddingService = new EmbeddingService()
  try {
    const embedding = await embeddingService.generateEmbedding(query)

    // Search messages
    logger.log('正在搜索...')
    const messages = await findSimilarMessages(embedding, options)

    // Display results
    if (messages.length === 0) {
      logger.log('未找到相关消息')
    }
    else {
      logger.log('搜索结果：')
      logger.log('----------------------------------------')
      for (const message of messages) {
        const chat = chats.find(c => c.id === message.chatId)
        logger.withFields({
          id: message.id,
          chatId: message.chatId,
          chatName: chat?.name,
          type: message.type,
          similarity: message.similarity,
        }).log(formatMessage(message))
        logger.log('----------------------------------------')
      }
    }

    // Ask if continue
    const shouldContinue = await input.confirm({
      message: '是否继续搜索？',
      default: true,
    })

    if (shouldContinue)
      return searchMessages(adapter)
  }
  finally {
    embeddingService.destroy()
  }
}

export default async function search() {
  const config = getConfig()
  const apiId = Number(config.apiId)
  const apiHash = config.apiHash
  const phoneNumber = config.phoneNumber
  const apiKey = config.openaiApiKey

  if (!apiId || !apiHash || !phoneNumber) {
    logger.log('API_ID, API_HASH and PHONE_NUMBER are required')
    throw new Error('Missing required configuration')
  }

  if (!apiKey) {
    logger.log('OPENAI_API_KEY is required')
    throw new Error('Missing required configuration')
  }

  // Create client adapter
  const adapter = createAdapter({
    type: 'client',
    apiId,
    apiHash,
    phoneNumber,
  }) as ClientAdapter

  try {
    logger.log('连接到 Telegram...')
    await adapter.connect()
    logger.log('已连接！')

    await searchMessages(adapter)

    await adapter.disconnect()
  }
  catch (error) {
    await adapter.disconnect()
    throw error
  }
}
