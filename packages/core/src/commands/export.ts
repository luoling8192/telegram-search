import type { ClientAdapter } from '../adapter/client'
import type { TelegramMessageType } from '../adapter/types'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'
import { asc, eq } from 'drizzle-orm'

import { createAdapter } from '../adapter/factory'
import { getConfig } from '../composable/config'
import { useDB } from '../composable/db'
import { messages } from '../db/schema/message'
import { updateChat } from '../models/chat'
import { createMessage } from '../models/message'

const logger = useLogger()

/**
 * Get last message ID from database
 */
async function getLastMessageId(chatId: number): Promise<number> {
  const result = await useDB().select({ id: messages.id }).from(messages).where(eq(messages.chatId, chatId)).orderBy(asc(messages.id)).limit(1)

  return result[0]?.id || 0
}

/**
 * Sync all chats to database
 */
// async function syncChats(adapter: ClientAdapter) {
//   logger.log('正在同步所有会话信息...')
//   const chats = await adapter.getChats()
//   logger.debug(`获取到 ${chats.length} 个会话`)

//   for (const chat of chats) {
//     try {
//       await updateChat(chat)
//       logger.debug(`已同步会话: [${chat.type}] ${chat.name} (ID: ${chat.id})`)
//     }
//     catch (error) {
//       logger.withError(error).error(`同步会话失败: ${chat.name}`)
//     }
//   }
//   logger.log(`会话同步完成，共同步 ${chats.length} 个会话`)
// }

/**
 * Export messages from Telegram
 */
async function exportMessages(adapter: ClientAdapter) {
  // Get all folders
  // const folders = await adapter.getFolders()
  // logger.debug(`获取到 ${folders.length} 个文件夹`)
  // const folderChoices = folders.map(folder => ({
  //   name: `${folder.emoji || ''} ${folder.title}`,
  //   value: folder.id,
  // }))

  // Let user select folder
  // const folderId = await input.select({
  //   message: '请选择要导出的文件夹：',
  //   choices: folderChoices,
  // })

  // Get all chats in folder
  const dialogs = await adapter.getDialogs()
  logger.debug(`获取到 ${dialogs.dialogs.length} 个会话`)
  const chatChoices = dialogs.dialogs.map(dialog => ({
    name: `[${dialog.type}] ${dialog.name} (${dialog.unreadCount} 条未读)`,
    value: dialog.id,
  }))

  // Let user select chat
  const chatId = await input.select({
    message: '请选择要导出的会话：',
    choices: chatChoices,
  })
  const selectedChat = dialogs.dialogs.find(d => d.id === chatId)
  if (!selectedChat) {
    throw new Error(`找不到会话: ${chatId}`)
  }
  logger.debug(`已选择会话: ${selectedChat.name} (ID: ${chatId})`)

  // Get export type
  const exportType = await input.select({
    message: '请选择导出类型：',
    choices: [
      { name: '导出到数据库', value: 'db' },
      { name: '导出到文件', value: 'file' },
    ],
  })

  // Get export options
  const useTimeRange = await input.confirm({
    message: '是否设置时间范围？',
    default: false,
  })

  let startTime: Date | undefined
  let endTime: Date | undefined
  if (useTimeRange) {
    const startDateStr = await input.input({
      message: '请输入开始时间 (YYYY-MM-DD)：',
      default: '2000-01-01',
    })
    startTime = new Date(startDateStr)

    const endDateStr = await input.input({
      message: '请输入结束时间 (YYYY-MM-DD)：',
      default: new Date().toISOString().split('T')[0],
    })
    endTime = new Date(endDateStr)
  }

  const messageLimit = await input.input({
    message: '请输入要导出的消息数量（0 表示全部）：',
    default: '0',
  })

  const batchSize = await input.input({
    message: '每多少条消息提醒一次继续？',
    default: '3000',
  })

  const messageTypes = await input.checkbox({
    message: '请选择要导出的消息类型：',
    choices: [
      { name: '文本消息', value: 'text', checked: true },
      { name: '图片', value: 'photo' },
      { name: '文档', value: 'document' },
      { name: '视频', value: 'video' },
      { name: '贴纸', value: 'sticker' },
      { name: '其他', value: 'other' },
    ],
  })

  // Export messages
  logger.log('正在导出消息...')
  let count = 0
  let failedCount = 0
  let skippedCount = 0

  if (exportType === 'db') {
    // Get last message ID for incremental update
    const lastMessageId = await getLastMessageId(chatId)
    logger.debug(`上次同步的最后消息 ID: ${lastMessageId}`)

    // Export to database
    const currentBatchSize = Number(batchSize)
    let currentBatch = []
    let totalProcessed = 0
    const messagesByType: Record<string, number> = {}

    logger.log('开始获取所有消息，这可能需要一些时间...')
    // 使用新的选项
    for await (const message of adapter.getMessages(Number(chatId), undefined, {
      skipMedia: !messageTypes.includes('photo') && !messageTypes.includes('document') && !messageTypes.includes('video') && !messageTypes.includes('sticker'),
      startTime,
      endTime,
      limit: Number(messageLimit) || undefined,
      messageTypes: messageTypes as TelegramMessageType[],
    })) {
      // 增量更新：跳过已存在的消息
      if (message.id <= lastMessageId) {
        skippedCount++
        if (skippedCount % 100 === 0) {
          logger.debug(`已跳过 ${skippedCount} 条已存在的消息`)
        }
        continue
      }

      // 检查消息类型是否需要导出
      if (!messageTypes.includes(message.type)) {
        skippedCount++
        continue
      }

      // 统计消息类型
      messagesByType[message.type] = (messagesByType[message.type] || 0) + 1

      currentBatch.push(message)
      count++

      // 当批次达到设定值时，进行一次导入
      if (currentBatch.length >= currentBatchSize) {
        try {
          await createMessage(currentBatch)
          totalProcessed += currentBatch.length
          // 输出详细的进度信息
          logger.log(`已导入 ${totalProcessed} 条消息`)
          logger.debug('当前消息类型统计：')
          for (const [type, typeCount] of Object.entries(messagesByType)) {
            logger.debug(`- ${type}: ${typeCount} 条`)
          }

          // 询问是否继续
          const shouldContinue = await input.confirm({
            message: `已处理 ${totalProcessed} 条消息，是否继续？`,
            default: true,
          })

          if (!shouldContinue) {
            logger.log('用户取消导出')
            return
          }
        }
        catch (error) {
          failedCount += currentBatch.length
          logger.withError(error).error(`导入消息批次失败 (${currentBatch[0].id} - ${currentBatch[currentBatch.length - 1].id})`)
        }
        currentBatch = []

        // 每 1000 条消息更新一次会话信息
        if (totalProcessed % 1000 === 0) {
          try {
            await updateChat({
              ...selectedChat,
              messageCount: totalProcessed,
              lastSyncTime: new Date(),
              title: '',
            })
            logger.debug('已更新会话消息计数')
          }
          catch (error) {
            logger.withError(error).error('更新会话消息计数失败')
          }
        }
      }
    }

    // 处理最后一个不完整的批次
    if (currentBatch.length > 0) {
      try {
        await createMessage(currentBatch)
        totalProcessed += currentBatch.length
        // 输出最终的统计信息
        logger.log('导入完成！')
        logger.log(`总计导入 ${totalProcessed} 条消息`)
        logger.log('最终消息类型统计：')
        for (const [type, typeCount] of Object.entries(messagesByType)) {
          logger.log(`- ${type}: ${typeCount} 条`)
        }
      }
      catch (error) {
        failedCount += currentBatch.length
        logger.withError(error).error(`导入最后一批消息失败 (${currentBatch[0].id} - ${currentBatch[currentBatch.length - 1].id})`)
      }
    }

    // 最后更新一次会话信息
    try {
      await updateChat({
        ...selectedChat,
        messageCount: totalProcessed,
        lastSyncTime: new Date(),
        title: '',
      })
      logger.debug('已更新会话消息计数')
    }
    catch (error) {
      logger.withError(error).error('更新会话消息计数失败')
    }
  }
  else {
    // Get export format
    const format = await input.select({
      message: '请选择导出格式：',
      choices: [
        { name: 'HTML', value: 'html' },
        { name: 'JSON', value: 'json' },
      ],
    })

    // Get export path
    const exportPath = await input.input({
      message: '请输入导出路径：',
      default: './export',
    })

    // Create export directory
    await fs.mkdir(exportPath, { recursive: true })
    logger.debug(`已创建导出目录: ${exportPath}`)

    // Export to file
    const messages = []
    for await (const message of adapter.getMessages(Number(chatId), undefined, { skipMedia: true })) {
      messages.push(message)
      count++
      if (count % 100 === 0) {
        logger.debug(`已处理 ${count} 条消息`)
      }
    }

    // Save to file
    const fileName = `${chatId}_${new Date().toISOString().split('T')[0]}`
    const filePath = path.join(exportPath, `${fileName}.${format}`)

    try {
      if (format === 'json') {
        await fs.writeFile(filePath, JSON.stringify(messages, null, 2))
        logger.debug(`已保存 JSON 文件: ${filePath}`)
      }
      else {
        // TODO: 实现 HTML 导出
        logger.warn('HTML 导出暂未实现')
        failedCount = count
      }
    }
    catch (error) {
      failedCount = count
      logger.withError(error).error(`保存文件失败: ${filePath}`)
    }

    if (failedCount === 0) {
      logger.log(`已导出到文件: ${filePath}`)
    }
  }

  const summary = failedCount > 0
    ? `导出完成，共导出 ${count} 条消息，${failedCount} 条消息失败，${skippedCount} 条消息已存在`
    : `导出完成，共导出 ${count} 条消息，${skippedCount} 条消息已存在`
  logger.log(summary)

  // Ask if continue
  const shouldContinue = await input.confirm({
    message: '是否继续导出？',
    default: false,
  })

  if (shouldContinue) {
    return exportMessages(adapter)
  }
}

export default async function exportCmd() {
  const config = getConfig()
  const apiId = Number(config.apiId)
  const apiHash = config.apiHash
  const phoneNumber = config.phoneNumber

  if (!apiId || !apiHash || !phoneNumber) {
    logger.log('API_ID, API_HASH and PHONE_NUMBER are required')
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

    // Sync all chats
    logger.log('正在同步所有会话信息...')
    const chats = await adapter.getChats()
    logger.debug(`获取到 ${chats.length} 个会话`)

    for (const chat of chats) {
      try {
        await updateChat(chat)
        logger.debug(`已同步会话: [${chat.type}] ${chat.name} (ID: ${chat.id})`)
      }
      catch (error) {
        logger.withError(error).error(`同步会话失败: ${chat.name}`)
      }
    }
    logger.log(`会话同步完成，共同步 ${chats.length} 个会话`)

    await exportMessages(adapter)

    await adapter.disconnect()
  }
  catch (error) {
    await adapter.disconnect()
    throw error
  }
}
