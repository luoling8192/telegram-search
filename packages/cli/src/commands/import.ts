import type { MessageType } from '@tg-search/db'

import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { createMessage, insertMessageContent } from '@tg-search/db'
import { glob } from 'glob'
import { JSDOM } from 'jsdom'

import { TelegramCommand } from '../command'

const logger = useLogger()

interface ImportOptions {
  chatId?: string
  path?: string
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
  fromAvatar?: {
    type: 'photo' | 'emoji'
    value: string
    color?: string
  }
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
 * Extract avatar info from element
 */
function extractAvatarInfo(element: Element) {
  const avatarElement = element.querySelector('.userpic')
  if (!avatarElement)
    return undefined

  // 检查是否是表情符号头像
  const emojiElement = avatarElement.querySelector('.emoji')
  if (emojiElement) {
    const color = avatarElement.getAttribute('data-color')
    return {
      type: 'emoji' as const,
      value: emojiElement.textContent || '👤',
      color: color || undefined,
    }
  }

  // 检查是否是图片头像
  const imgElement = avatarElement.querySelector('img')
  if (imgElement) {
    return {
      type: 'photo' as const,
      value: imgElement.getAttribute('src') || '',
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
  const basicDate = new Date(dateStr.split(' UTC')[0].split('.').reverse().join('-'))

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
async function parseHtmlFile(filePath: string): Promise<MessageData[]> {
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
      const fromAvatar = extractAvatarInfo(element)

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
            fromAvatar,
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

/**
 * Import command to import messages from HTML files
 */
export class ImportCommand extends TelegramCommand {
  meta = {
    name: 'import',
    description: 'Import messages from HTML files',
    usage: '<chatId> <path> [options]',
  }

  async execute(args: string[], options: ImportOptions): Promise<void> {
    // Get chat ID and path
    const chatId = options.chatId || args[0]
    const path = options.path || args[1]

    if (!chatId || !path) {
      throw new Error('Chat ID and path are required')
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

      // Process each file
      for (const file of files) {
        const filePath = join(basePath, file)
        logger.debug(`正在处理文件: ${filePath}`)

        try {
          // Parse messages from file
          const messages = await parseHtmlFile(filePath)
          logger.debug(`从文件中解析出 ${messages.length} 条消息`)

          // Set chat ID for all messages
          for (const message of messages) {
            message.chatId = Number(chatId)
          }

          // Generate embeddings if needed
          if (!options.noEmbedding) {
            logger.debug('正在生成向量嵌入...')
            const contents = messages.map(m => m.content)
            const embeddings = await embedding.generateEmbeddings(contents)
            logger.debug('向量嵌入生成完成')

            // Save messages with embeddings
            for (let i = 0; i < messages.length; i++) {
              try {
                const { mediaInfo, links, fromName, ...messageData } = messages[i]
                // Create message metadata
                await createMessage({
                  id: messageData.id,
                  chatId: messageData.chatId,
                  type: messageData.type,
                  createdAt: messageData.createdAt,
                  fromId: messageData.fromId,
                  replyToId: messageData.replyToId,
                  forwardFromChatId: messageData.forwardFromChatId,
                  forwardFromMessageId: messageData.forwardFromMessageId,
                  views: messageData.views,
                  forwards: messageData.forwards,
                })

                // Insert message content with embedding
                await insertMessageContent(messageData.chatId, {
                  id: messageData.id,
                  chatId: messageData.chatId,
                  type: messageData.type,
                  content: messageData.content,
                  embedding: embeddings[i],
                  mediaInfo: mediaInfo || null,
                  createdAt: messageData.createdAt,
                  fromId: messageData.fromId,
                  fromName: messageData.fromName,
                  replyToId: messageData.replyToId,
                  forwardFromChatId: messageData.forwardFromChatId,
                  forwardFromMessageId: messageData.forwardFromMessageId,
                  views: messageData.views,
                  forwards: messageData.forwards,
                  links: links || null,
                  metadata: {
                    // 存储任何其他可能有用的信息
                    hasLinks: links && links.length > 0,
                    hasMedia: !!mediaInfo,
                    isForwarded: !!messageData.forwardFromChatId,
                    isReply: !!messageData.replyToId,
                  },
                })

                totalMessages++
              }
              catch (error) {
                logger.withError(error).warn(`保存消息 ${messages[i].id} 失败`)
                failedEmbeddings++
              }
            }
          }
          else {
            // Save messages without embeddings
            for (const message of messages) {
              try {
                const { mediaInfo, links, fromName, ...messageData } = message
                // Create message metadata
                await createMessage({
                  id: messageData.id,
                  chatId: messageData.chatId,
                  type: messageData.type,
                  createdAt: messageData.createdAt,
                  fromId: messageData.fromId,
                  replyToId: messageData.replyToId,
                  forwardFromChatId: messageData.forwardFromChatId,
                  forwardFromMessageId: messageData.forwardFromMessageId,
                  views: messageData.views,
                  forwards: messageData.forwards,
                })

                // Insert message content without embedding
                await insertMessageContent(messageData.chatId, {
                  id: messageData.id,
                  chatId: messageData.chatId,
                  type: messageData.type,
                  content: messageData.content,
                  embedding: null,
                  mediaInfo: mediaInfo || null,
                  createdAt: messageData.createdAt,
                  fromId: messageData.fromId,
                  replyToId: messageData.replyToId,
                  forwardFromChatId: messageData.forwardFromChatId,
                  forwardFromMessageId: messageData.forwardFromMessageId,
                  views: messageData.views,
                  forwards: messageData.forwards,
                })

                totalMessages++
              }
              catch (error) {
                logger.withError(error).warn(`保存消息 ${message.id} 失败`)
                failedEmbeddings++
              }
            }
          }

          logger.debug(`文件处理完成: ${file}`)
        }
        catch (error) {
          logger.withError(error).error(`处理文件失败: ${file}`)
        }
      }

      logger.log(`导入完成，共导入 ${totalMessages} 条消息，${failedEmbeddings} 条消息生成向量嵌入失败`)
    }
    catch (error) {
      logger.withError(error).error('导入失败')
      throw error
    }
  }
}

// Register command
export default new ImportCommand()
