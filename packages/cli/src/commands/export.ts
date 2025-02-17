import type { Dialog, TelegramMessage } from '@tg-search/core'
import type { MessageType, NewChat } from '@tg-search/db'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as input from '@inquirer/prompts'
import { getConfig, useLogger } from '@tg-search/common'
import { createMessageBatch, updateChat } from '@tg-search/db'

import { TelegramCommand } from '../command'

const logger = useLogger()

interface ExportOptions {
  chatId?: number
  format?: 'database' | 'html' | 'json'
  path?: string
  messageTypes?: MessageType[]
  startTime?: Date
  endTime?: Date
  limit?: number
  batchSize?: number
}

/**
 * Process a batch of messages for database export
 */
async function processDatabaseBatch(
  messages: TelegramMessage[],
  startIndex: number,
): Promise<{ failedCount: number }> {
  try {
    // Create messages in batch
    await createMessageBatch(messages)
    const firstMessage = messages[0]
    const lastMessage = messages[messages.length - 1]

    logger.debug(
      `已保存 ${startIndex + 1} - ${startIndex + messages.length} 条消息 `
      + `(ID: ${firstMessage.id} - ${lastMessage.id})`,
    )

    return { failedCount: 0 }
  }
  catch (error) {
    logger.withError(error).error(`保存批次消息失败 (${startIndex + 1} - ${startIndex + messages.length})`)
    return { failedCount: messages.length }
  }
}

/**
 * Save messages to JSON file
 */
async function saveToJsonFile(messages: any[], chatId: number, exportPath: string): Promise<boolean> {
  try {
    const fileName = `${chatId}_${new Date().toISOString().split('T')[0]}`
    const filePath = path.join(exportPath, `${fileName}.json`)
    await fs.writeFile(filePath, JSON.stringify(messages, null, 2))
    logger.debug(`已保存 JSON 文件: ${filePath}`)
    logger.log(`已导出到文件: ${filePath}`)
    return true
  }
  catch (error) {
    logger.withError(error).error('保存 JSON 文件失败')
    return false
  }
}

/**
 * Update chat metadata
 */
async function updateChatMetadata(chat: Dialog): Promise<void> {
  const chatInput: NewChat = {
    id: chat.id,
    type: chat.type,
    title: chat.name,
    lastSyncTime: new Date(),
  }
  await updateChat(chatInput)
}

/**
 * Export command to export messages from Telegram
 */
export class ExportCommand extends TelegramCommand {
  meta = {
    name: 'export',
    description: 'Export messages from Telegram',
    usage: '[options]',
    requiresConnection: true,
  }

  async execute(_args: string[], options: ExportOptions): Promise<void> {
    // Get all chats in folder
    const dialogs = await this.getClient().getDialogs()
    logger.debug(`获取到 ${dialogs.dialogs.length} 个会话`)
    const chatChoices = dialogs.dialogs.map((dialog: Dialog) => ({
      name: `[${dialog.type}] ${dialog.name} (${dialog.unreadCount} 条未读)`,
      value: dialog.id,
    }))

    // Let user select chat
    const chatId = options.chatId || await input.select({
      message: '请选择要导出的会话：',
      choices: chatChoices,
    })
    const selectedChat = dialogs.dialogs.find((d: Dialog) => d.id === chatId)
    if (!selectedChat) {
      throw new Error(`找不到会话: ${chatId}`)
    }
    logger.debug(`已选择会话: ${selectedChat.name} (ID: ${chatId})`)

    // Get export format
    const format = options.format || await input.select({
      message: '请选择导出格式：',
      choices: [
        { name: 'Database', value: 'database' },
      ],
    })

    // Get export path if not exporting to database
    let exportPath = options.path
    if (format !== 'database') {
      exportPath = exportPath || await input.input({
        message: '请输入导出路径：',
        default: './export',
      })

      // Create export directory
      await fs.mkdir(exportPath, { recursive: true })
      logger.debug(`已创建导出目录: ${exportPath}`)
    }

    // Get message types
    const messageTypes = options.messageTypes || await input.checkbox({
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

    // Get time range
    let startTime = options.startTime
    let endTime = options.endTime
    if (!startTime || !endTime) {
      const useTimeRange = await input.confirm({
        message: '是否设置时间范围？',
        default: false,
      })

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
    }

    // Get message limit
    const limit = options.limit || await input.input({
      message: '请输入要导出的消息数量（0 表示全部）：',
      default: '0',
    })

    // Get batch size from config
    const batchSize = options.batchSize || getConfig().messageBatchSize

    // Export messages
    logger.log('正在导出消息...')
    let count = 0
    let failedCount = 0
    const messages = []

    // Export messages
    for await (const message of this.getClient().getMessages(Number(chatId), undefined, {
      skipMedia: !messageTypes.includes('photo') && !messageTypes.includes('document') && !messageTypes.includes('video') && !messageTypes.includes('sticker'),
      startTime,
      endTime,
      limit: Number(limit) || undefined,
      messageTypes,
    })) {
      messages.push(message)
      count++
      if (count % Number(batchSize) === 0) {
        logger.debug(`已处理 ${count} 条消息`)

        // Save current batch to database if format is database
        if (format === 'database') {
          const batch = messages.slice(count - Number(batchSize), count)
          const messageInputs: TelegramMessage[] = batch.map((message: TelegramMessage) => ({
            id: message.id,
            chatId: message.chatId,
            type: message.type,
            content: message.content,
            fromId: message.fromId,
            fromName: message.fromName,
            replyToId: message.replyToId,
            forwardFromChatId: message.forwardFromChatId,
            forwardFromChatName: message.forwardFromChatName,
            forwardFromMessageId: message.forwardFromMessageId,
            views: message.views,
            forwards: message.forwards,
            links: message.links || undefined,
            metadata: message.metadata,
            createdAt: message.createdAt,
          }))

          const result = await processDatabaseBatch(messageInputs, count - Number(batchSize))
          failedCount += result.failedCount
        }
      }
    }

    // Save to file or database
    try {
      if (format === 'json') {
        const success = await saveToJsonFile(messages, chatId, exportPath!)
        if (!success) {
          failedCount = count
        }
      }
      else if (format === 'database') {
        // Update chat metadata
        await updateChatMetadata(selectedChat)

        // Save remaining messages
        const remainingCount = count % Number(batchSize)
        if (remainingCount > 0) {
          const batch = messages.slice(-remainingCount)
          const messageInputs: TelegramMessage[] = batch.map((message: TelegramMessage) => ({
            id: message.id,
            chatId: message.chatId,
            type: message.type,
            content: message.content,
            fromId: message.fromId,
            fromName: message.fromName,
            replyToId: message.replyToId,
            forwardFromChatId: message.forwardFromChatId,
            forwardFromChatName: message.forwardFromChatName,
            forwardFromMessageId: message.forwardFromMessageId,
            views: message.views,
            forwards: message.forwards,
            links: message.links || undefined,
            metadata: message.metadata,
            createdAt: message.createdAt,
          }))

          const result = await processDatabaseBatch(messageInputs, count - remainingCount)
          failedCount += result.failedCount
        }

        if (failedCount === 0) {
          logger.log('已导出到数据库')
        }
      }
      else {
        // TODO: 实现 HTML 导出
        logger.warn('HTML 导出暂未实现')
        failedCount = count
      }
    }
    catch (error) {
      failedCount = count
      logger.withError(error).error(`保存失败`)
    }

    const summary = failedCount > 0
      ? `导出完成，共导出 ${count} 条消息，${failedCount} 条消息失败`
      : `导出完成，共导出 ${count} 条消息`
    logger.log(summary)
  }
}

// Register command
export default new ExportCommand()
