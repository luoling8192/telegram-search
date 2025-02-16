import type { Dialog, TelegramMessageType } from '@tg-search/core'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'

import { TelegramCommand } from '../command'

const logger = useLogger()

interface ExportOptions {
  chatId?: number
  format?: 'json' | 'html'
  path?: string
  messageTypes?: TelegramMessageType[]
  startTime?: Date
  endTime?: Date
  limit?: number
  batchSize?: number
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
        { name: 'HTML', value: 'html' },
        { name: 'JSON', value: 'json' },
      ],
    })

    // Get export path
    const exportPath = options.path || await input.input({
      message: '请输入导出路径：',
      default: './export',
    })

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

    // Get batch size
    const batchSize = options.batchSize || await input.input({
      message: '每多少条消息提醒一次继续？',
      default: '3000',
    })

    // Create export directory
    await fs.mkdir(exportPath, { recursive: true })
    logger.debug(`已创建导出目录: ${exportPath}`)

    // Export messages
    logger.log('正在导出消息...')
    let count = 0
    let failedCount = 0
    const skippedCount = 0
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
      await this.execute(_args, options)
    }
  }
}

// Register command
export default new ExportCommand()
