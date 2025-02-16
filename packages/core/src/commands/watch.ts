import type { ClientAdapter } from '../adapter/client'
import type { TelegramMessage } from '../adapter/types'

import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'

import { createAdapter } from '../adapter/factory'
import { getConfig } from '../composable/config'
import { createMessage } from '../models/message'

const logger = useLogger()

async function watchChat(adapter: ClientAdapter, chatId: number, folderTitle: string) {
  // Get dialog info
  const result = await adapter.getDialogs(0, 100)
  const selectedDialog = result.dialogs.find(d => d.id === chatId)
  if (!selectedDialog) {
    logger.log('找不到该对话')
    return
  }

  logger.log(`开始监听 "${selectedDialog.name}" 的 "${folderTitle}" 文件夹...`)
  let count = 0

  // Setup message handler
  adapter.onMessage(async (message: TelegramMessage) => {
    // Only handle messages from selected chat
    if (message.chatId !== chatId)
      return

    // Only handle text messages
    if (message.type !== 'text') {
      logger.log(`[${new Date().toLocaleString()}] 跳过非文本消息: ${message.type}`)
      return
    }

    try {
      await createMessage({
        id: message.id,
        chatId: message.chatId,
        type: message.type,
        content: message.content,
        fromId: message.fromId,
        replyToId: message.replyToId,
        forwardFromChatId: message.forwardFromChatId,
        forwardFromMessageId: message.forwardFromMessageId,
        views: message.views,
        forwards: message.forwards,
        createdAt: message.createdAt,
      })
      count++
      logger.log(`[${new Date().toLocaleString()}] 已保存 ${count} 条新消息`)
    }
    catch (error) {
      logger.withError(error).error('保存消息失败:')
    }
  })

  // Keep the process running
  logger.log('按 Ctrl+C 停止监听')
  return count
}

export default async function watch() {
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

    // Get all folders
    const folders = await adapter.getFolders()
    logger.debug(`获取到 ${folders.length} 个文件夹`)
    const folderChoices = folders.map(folder => ({
      name: `${folder.emoji || ''} ${folder.title}`,
      value: folder.id,
    }))

    // Let user select folder
    const folderId = await input.select({
      message: '请选择要监听的文件夹：',
      choices: folderChoices,
    })

    // Get all chats in folder
    const dialogs = await adapter.getDialogs()
    logger.debug(`获取到 ${dialogs.dialogs.length} 个会话`)
    const chatChoices = dialogs.dialogs.map(dialog => ({
      name: `[${dialog.type}] ${dialog.name} (${dialog.unreadCount} 条未读)`,
      value: dialog.id,
    }))

    // Let user select chat
    const chatId = await input.select({
      message: '请选择要监听的会话：',
      choices: chatChoices,
    })

    const selectedFolder = folders.find(f => f.id === folderId)
    if (!selectedFolder) {
      logger.log('找不到选择的文件夹')
      return
    }

    return watchChat(adapter, chatId, selectedFolder.title)
  }
  catch (error) {
    await adapter.disconnect()
    throw error
  }
}
