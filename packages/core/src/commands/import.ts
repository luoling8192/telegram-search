import type { MessageType } from '../db/schema/message'

import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { useLogger } from '@tg-search/common'
import { Command } from 'commander'
import { parse as parseDate } from 'date-fns'
import { glob } from 'glob'
import { JSDOM } from 'jsdom'

import { createMessage } from '../models/message'
import { EmbeddingService } from '../services/embedding'

interface ImportOptions {
  chatId: string
  path: string
  noEmbedding?: boolean
}

interface MessageData {
  id: number
  chatId: number
  type: MessageType
  content: string
  createdAt: Date
  fromId?: number
  fromName?: string
  links?: string[]
  replyToId?: number
  forwardFromChatId?: number
  forwardFromMessageId?: number
  views?: number
  forwards?: number
  mediaInfo?: {
    fileId: string
    type: string
    mimeType?: string
    fileName?: string
    fileSize?: number
    width?: number
    height?: number
    duration?: number
    thumbnail?: {
      fileId: string
      width: number
      height: number
    }
  }
}

/**
 * Extract media info from message element
 */
function extractMediaInfo(element: Element) {
  // 检查图片
  const photo = element.querySelector('.media_photo')
  if (photo) {
    const status = photo.querySelector('.status.details')
    const dimensions = status?.textContent?.match(/(\d+)x(\d+)/)
    return {
      fileId: photo.querySelector('img')?.getAttribute('src') || '',
      type: 'photo',
      width: dimensions?.[1] ? Number(dimensions[1]) : undefined,
      height: dimensions?.[2] ? Number(dimensions[2]) : undefined,
    }
  }

  // 检查视频
  const video = element.querySelector('.media_video')
  if (video) {
    const status = video.querySelector('.status.details')
    const duration = status?.textContent?.match(/(\d+):(\d+)/)
    return {
      fileId: video.querySelector('video')?.getAttribute('src') || '',
      type: 'video',
      duration: duration ? Number(duration[1]) * 60 + Number(duration[2]) : undefined,
    }
  }

  // 检查文件
  const document = element.querySelector('.media_document')
  if (document) {
    const title = document.querySelector('.title.bold')
    const status = document.querySelector('.status.details')
    const size = status?.textContent?.match(/([\d.]+) (\w+)/)
    let fileSize: number | undefined
    if (size) {
      const [, value, unit] = size
      fileSize = Number(value)
      if (unit === 'KB')
        fileSize *= 1024
      else if (unit === 'MB')
        fileSize *= 1024 * 1024
      else if (unit === 'GB')
        fileSize *= 1024 * 1024 * 1024
    }
    return {
      fileId: document.querySelector('a')?.getAttribute('href') || '',
      type: 'document',
      fileName: title?.textContent?.trim(),
      fileSize,
    }
  }

  // 检查贴纸
  const sticker = element.querySelector('.media_photo')
  if (sticker?.classList.contains('sticker')) {
    const img = sticker.querySelector('img')
    return {
      fileId: img?.getAttribute('src') || '',
      type: 'sticker',
      width: img?.getAttribute('width') ? Number(img.getAttribute('width')) : undefined,
      height: img?.getAttribute('height') ? Number(img.getAttribute('height')) : undefined,
    }
  }

  return undefined
}

/**
 * Determine message type from element
 */
function getMessageType(element: Element): MessageType {
  if (element.querySelector('.photo_wrap'))
    return 'photo'
  if (element.querySelector('.video_file_wrap'))
    return 'video'
  if (element.querySelector('.document_wrap'))
    return 'document'
  if (element.querySelector('.sticker'))
    return 'sticker'
  return 'text'
}

/**
 * Parse date string from Telegram export
 * Format: DD.MM.YYYY HH:mm:ss UTC+HH:mm
 */
function parseTelegramDate(dateStr: string): Date {
  // 先解析基本日期时间
  const basicDate = parseDate(dateStr.split(' UTC')[0], 'dd.MM.yyyy HH:mm:ss', new Date())

  // 解析时区
  const tzMatch = dateStr.match(/UTC([+-]\d{2}):(\d{2})/)
  if (!tzMatch)
    return basicDate

  const [, tzHour, tzMinute] = tzMatch
  const tzOffset = (Number(tzHour) * 60 + Number(tzMinute)) * (tzHour.startsWith('-') ? -1 : 1)

  // 调整时区
  basicDate.setMinutes(basicDate.getMinutes() - tzOffset)
  return basicDate
}

/**
 * Parse HTML message file and extract messages
 */
async function parseHtmlFile(filePath: string, logger: ReturnType<typeof useLogger>): Promise<MessageData[]> {
  const content = await readFile(filePath, 'utf-8')
  const dom = new JSDOM(content)
  const document = dom.window.document

  const messageElements = document.querySelectorAll('div.message.default.clearfix')

  // Convert NodeList to Array for functional iteration
  return Array.from(messageElements)
    .reduce((acc: MessageData[], element: Element) => {
      const id = Number(element.getAttribute('id')?.replace('message', ''))
      const body = element.querySelector('.body')
      if (!body)
        return acc

      // Get sender info
      const fromNameElement = body.querySelector('.from_name')
      const fromName = fromNameElement?.textContent?.trim()
      const fromId = fromNameElement?.getAttribute('data-peer-id')

      // Get message content
      const textElement = body.querySelector('.text')
      const mediaElement = body.querySelector('.media_wrap')
      let text = textElement?.textContent?.trim() || ''

      // 如果是媒体消息，尝试获取媒体描述
      if (mediaElement) {
        const mediaTitle = mediaElement.querySelector('.title.bold')?.textContent?.trim()
        const mediaDesc = mediaElement.querySelector('.description')?.textContent?.trim()
        if (mediaTitle) {
          text = text || `[${mediaTitle}]`
          if (mediaDesc && mediaDesc !== 'Not included, change data exporting settings to download.') {
            text += `: ${mediaDesc}`
          }
        }
      }

      // Get links
      const links = Array.from(body.querySelectorAll('a'))
        .map(a => a.getAttribute('href'))
        .filter((href): href is string => href !== null)

      // Get date
      const dateElement = body.querySelector('.date.details')
      const dateStr = dateElement?.getAttribute('title')

      // Get reply info
      const replyElement = body.querySelector('.reply_to.details')
      const replyToId = replyElement?.textContent
        ?.match(/In reply to (\d+)/)?.[1]

      // Get forward info
      const forwardElement = body.querySelector('.forwarded.body')
      const forwardFromChatId = forwardElement?.getAttribute('data-peer-id')
      const forwardFromMessageId = forwardElement?.getAttribute('data-post')

      // Get message stats
      const viewsElement = body.querySelector('.views')
      const views = viewsElement?.textContent ? Number(viewsElement.textContent.match(/\d+/)?.[0]) : undefined

      const forwardsElement = body.querySelector('.forwards')
      const forwards = forwardsElement?.textContent ? Number(forwardsElement.textContent.match(/\d+/)?.[0]) : undefined

      if (id && dateStr) {
        try {
          const createdAt = parseTelegramDate(dateStr)
          acc.push({
            id,
            chatId: 0, // Will be set from command line
            type: getMessageType(element),
            content: text,
            createdAt,
            fromId: fromId ? Number(fromId) : undefined,
            fromName,
            links: links.length > 0 ? links : undefined,
            replyToId: replyToId ? Number(replyToId) : undefined,
            forwardFromChatId: forwardFromChatId ? Number(forwardFromChatId) : undefined,
            forwardFromMessageId: forwardFromMessageId ? Number(forwardFromMessageId) : undefined,
            views,
            forwards,
            mediaInfo: extractMediaInfo(element),
          })
        }
        catch (error) {
          logger.withError(error).warn(`解析消息 ${id} 的日期失败: ${dateStr}`)
        }
      }

      return acc
    }, [])
}

export default async function importMessages(chatId?: string, path?: string, options: Partial<ImportOptions> = {}) {
  const logger = useLogger()

  // 如果没有直接传入参数，则从命令行获取
  if (!chatId || !path) {
    const program = new Command()
    program
      .argument('<chatId>', 'Chat ID to import messages to')
      .argument('<path>', 'Path to HTML files')
      .option('--no-embedding', 'Skip generating embeddings')
      .parse()

    const args = program.args
    chatId = args[0]
    path = args[1]
    options = program.opts()
  }

  // Initialize embedding service
  const embedding = new EmbeddingService()

  try {
    const basePath = resolve(path)
    logger.debug(`正在搜索文件: ${basePath}`)

    // Find all HTML files
    const files = await glob('**/*.html', {
      cwd: basePath,
      absolute: false,
    })

    if (files.length === 0) {
      logger.warn('未找到任何 HTML 文件')
      return
    }

    logger.debug(`找到 ${files.length} 个文件`)
    let totalMessages = 0
    let failedEmbeddings = 0

    for (const file of files) {
      const fullPath = join(basePath, file)
      logger.debug(`正在处理文件: ${file}`)
      const parsedMessages = await parseHtmlFile(fullPath, logger)

      if (parsedMessages.length === 0) {
        logger.warn(`文件 ${file} 中未找到任何消息`)
        continue
      }

      // Set chat ID for all messages
      const chatIdNum = Number(chatId)
      parsedMessages.forEach(msg => msg.chatId = chatIdNum)

      // Generate embeddings in batches
      const batchSize = 100
      for (let i = 0; i < parsedMessages.length; i += batchSize) {
        const batch = parsedMessages.slice(i, i + batchSize)
        let embeddings: number[][] = []

        if (!options.noEmbedding) {
          try {
            const texts = batch.map(msg => msg.content)
            embeddings = await embedding.generateEmbeddings(texts)
          }
          catch (error) {
            logger.withError(error).warn('生成向量嵌入失败，将跳过向量嵌入')
            failedEmbeddings += batch.length
          }
        }

        // Insert messages
        try {
          await createMessage(
            batch.map((msg, idx) => ({
              id: msg.id,
              chatId: msg.chatId,
              type: msg.type,
              content: msg.content,
              embedding: options.noEmbedding ? undefined : embeddings[idx],
              mediaInfo: msg.mediaInfo,
              createdAt: msg.createdAt,
              fromId: msg.fromId,
              replyToId: msg.replyToId,
              forwardFromChatId: msg.forwardFromChatId,
              forwardFromMessageId: msg.forwardFromMessageId,
              views: msg.views,
              forwards: msg.forwards,
            })),
          )
        }
        catch (error) {
          logger.withError(error).error(`导入消息失败: ${msg.id}`)
        }

        logger.debug(`已处理 ${i + batch.length}/${parsedMessages.length} 条消息`)
      }

      totalMessages += parsedMessages.length
      logger.debug(`文件 ${file} 已导入 ${parsedMessages.length} 条消息`)
    }

    const summary = options.noEmbedding
      ? `导入完成，共导入 ${totalMessages} 条消息（未生成向量嵌入）`
      : `导入完成，共导入 ${totalMessages} 条消息，${failedEmbeddings} 条消息未生成向量嵌入`
    logger.debug(summary)
  }
  catch (error) {
    logger.withError(error).error('导入失败')
    process.exit(1)
  }
  finally {
    embedding.destroy()
  }
}
