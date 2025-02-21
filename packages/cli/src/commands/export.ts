import type { Dialog, MessageOptions, TelegramMessage } from '@tg-search/core'
import type { MessageType, NewChat } from '@tg-search/db'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as input from '@inquirer/prompts'
import { getConfig, useLogger } from '@tg-search/common'
import { createMessages, updateChat } from '@tg-search/db'

import { TelegramCommand } from '../command'

const logger = useLogger()

interface ExportOptions {
  chatMetadata?: NewChat
  chatId?: number
  format?: 'database' | 'html' | 'json'
  path?: string
  messageTypes?: MessageType[]
  startTime?: Date
  endTime?: Date
  limit?: number
  batchSize?: number
  method?: 'getMessage' | 'takeout'
}

interface ExportResult {
  count: number
  failedCount: number
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
    await createMessages(messages)
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
 * Handle message export process including batching and error handling
 */
async function handleMessageExport(
  messageIterator: AsyncIterable<TelegramMessage>,
  batchSize: number,
  format: string,
  chatId: number,
  exportPath?: string,
): Promise<ExportResult> {
  const messages: TelegramMessage[] = []
  let count = 0
  let failedCount = 0

  const processBatch = async (startIndex: number): Promise<void> => {
    if (format !== 'database')
      return

    const batch = messages.slice(startIndex - batchSize, startIndex)
    const messageInputs = batch.map((message: TelegramMessage) => ({
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

    const result = await processDatabaseBatch(messageInputs, startIndex - batchSize)
    failedCount += result.failedCount
  }

  for await (const message of messageIterator) {
    messages.push(message)
    count++

    if (count % batchSize === 0) {
      logger.debug(`已处理 ${count} 条消息`)
      await processBatch(count)
    }
  }

  // Handle remaining messages
  const remainingCount = count % batchSize
  if (remainingCount > 0 && format === 'database') {
    await processBatch(count)
  }

  // Save to file if needed
  if (format === 'json' && exportPath) {
    const success = await saveToJsonFile(messages, chatId, exportPath)
    if (!success) {
      failedCount = count
    }
  }

  return { count, failedCount }
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

  private async promptForOptions(options: ExportOptions): Promise<Required<ExportOptions>> {
    const chats = await this.getClient().getChats()
    logger.debug(`获取到 ${chats.length} 个会话`)

    const chatChoices = chats.map((chat: NewChat) => ({
      name: `[${chat.type}] ${chat.title} (${chat.messageCount} 条消息)`,
      value: chat.id,
    }))

    const chatId = options.chatId || await input.select({
      message: '请选择要导出的会话：',
      choices: chatChoices,
    })

    const chatMetadata = chats.find((c: NewChat) => c.id === chatId)

    const method = options.method || await input.select({
      message: '请选择导出方式：',
      choices: [
        { name: 'Takeout (推荐，可能需要等待)', value: 'takeout' },
        { name: 'GetMessage (立即导出，可能不完整)', value: 'getMessage' },
      ],
    })

    const format = options.format || await input.select({
      message: '请选择导出格式：',
      choices: [
        { name: 'Database', value: 'database' },
      ],
    })

    let exportPath = options.path
    if (format !== 'database') {
      exportPath = exportPath || await input.input({
        message: '请输入导出路径：',
        default: './export',
      })
      await fs.mkdir(exportPath, { recursive: true })
    }

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

    let { startTime, endTime } = options
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

    const limit = options.limit || Number(await input.input({
      message: '请输入要导出的消息数量（0 表示全部）：',
      default: '0',
    }))

    const batchSize = options.batchSize || getConfig().message.export.batchSize
    return {
      chatMetadata: chatMetadata!,
      chatId,
      method,
      format,
      path: exportPath || '',
      messageTypes,
      startTime: startTime || new Date(0),
      endTime: endTime || new Date(),
      limit,
      batchSize,
    }
  }

  async execute(_args: string[], options: ExportOptions): Promise<void> {
    const baseOptions = await this.promptForOptions(options)

    logger.withFields({
      baseOptions,
    }).debug('Export options')

    const {
      chatId,
      format,
      path: exportPath,
      limit,
      batchSize,
      chatMetadata,
    } = baseOptions

    logger.log('正在导出消息...')

    try {
      function isSkipMedia(type: MessageType) {
        return !baseOptions.messageTypes.includes(type)
      }

      const messageOptions: MessageOptions = {
        skipMedia: isSkipMedia('photo') || isSkipMedia('video') || isSkipMedia('document'), // TODO: 支持更多类型
        startTime: baseOptions.startTime,
        endTime: baseOptions.endTime,
        messageTypes: baseOptions.messageTypes,
        method: baseOptions.method,
        limit: baseOptions.limit,
      }

      const messageIterator = this.getClient().getMessages(
        Number(chatId),
        limit || 100,
        messageOptions,
      )

      const { count, failedCount } = await handleMessageExport(
        messageIterator,
        Number(batchSize),
        format,
        chatId,
        exportPath,
      )

      if (format === 'database') {
        await updateChatMetadata({
          id: chatMetadata.id,
          name: chatMetadata.title,
          type: chatMetadata.type as 'user' | 'group' | 'channel',
          unreadCount: 0,
        })

        if (failedCount === 0) {
          logger.log('已导出到数据库')
        }
      }
      else if (format === 'html') {
        logger.warn('HTML 导出暂未实现')
      }

      const summary = failedCount > 0
        ? `导出完成，共导出 ${count} 条消息，${failedCount} 条消息失败`
        : `导出完成，共导出 ${count} 条消息`
      logger.log(summary)
    }
    catch (error: any) {
      if (error?.message?.includes('FLOOD_WAIT')) {
        const waitSeconds = Number(error.message.match(/FLOOD_WAIT_(\d+)/)?.[1])
        if (waitSeconds) {
          const shouldWait = await input.confirm({
            message: `需要等待 ${waitSeconds} 秒才能继续导出，是否等待？`,
            default: true,
          })
          if (!shouldWait)
            throw error

          logger.log(`等待 ${waitSeconds} 秒...`)
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
          logger.log('继续导出...')
          await this.execute(_args, baseOptions)
        }
      }
      else {
        throw error
      }
    }
  }
}

// Register command
export default new ExportCommand()
