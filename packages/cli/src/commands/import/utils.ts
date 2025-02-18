import type { MessageType } from '@tg-search/db'
import type { MessageData } from './types'

import { readFile } from 'node:fs/promises'
import { useLogger } from '@tg-search/common'
import { JSDOM } from 'jsdom'

const logger = useLogger()

/**
 * Extract media info from message element
 */
export function extractMediaInfo(element: Element) {
  // Check photo
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

  // Check video
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

  // Check document
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

  // Check sticker
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
export function extractAvatarInfo(element: Element) {
  const avatarElement = element.querySelector('.userpic')
  if (!avatarElement)
    return undefined

  // Check emoji avatar
  const emojiElement = avatarElement.querySelector('.emoji')
  if (emojiElement) {
    const color = avatarElement.getAttribute('data-color')
    return {
      type: 'emoji' as const,
      value: emojiElement.textContent || '👤',
      color: color || undefined,
    }
  }

  // Check photo avatar
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
export function getMessageType(element: Element): MessageType {
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
export function parseTelegramDate(dateStr: string): Date {
  // Parse basic date time
  const basicDate = new Date(dateStr.split(' UTC')[0].split('.').reverse().join('-'))

  // Parse timezone
  const tzMatch = dateStr.match(/UTC([+-]\d{2}):(\d{2})/)
  if (!tzMatch)
    return basicDate

  const [, tzHour, tzMinute] = tzMatch
  const tzOffset = (Number(tzHour) * 60 + Number(tzMinute)) * (tzHour.startsWith('-') ? -1 : 1)

  // Adjust timezone
  basicDate.setMinutes(basicDate.getMinutes() - tzOffset)
  return basicDate
}

/**
 * Parse HTML message file and extract messages
 */
export async function parseHtmlFile(filePath: string): Promise<MessageData[]> {
  if (!filePath)
    throw new Error('File path is required')

  const content = await readFile(filePath, 'utf-8')
  const dom = new JSDOM(content)
  const document = dom.window.document

  const messageElements = document.querySelectorAll('div.message.default.clearfix')

  // Convert NodeList to Array for functional iteration
  return Array.from(messageElements)
    .map((element: Element): MessageData | null => {
      const id = Number(element.getAttribute('id')?.replace('message', ''))
      const body = element.querySelector('.body')
      if (!body)
        return null

      // Get sender info
      const fromNameElement = body.querySelector('.from_name')
      const fromName = fromNameElement?.textContent?.trim()
      const fromId = fromNameElement?.getAttribute('data-peer-id')
      const fromAvatar = extractAvatarInfo(element)

      // Get message content
      const textElement = body.querySelector('.text')
      const mediaElement = body.querySelector('.media_wrap')
      let text = textElement?.textContent?.trim() || ''

      // If media message, try to get media description
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
      const dateElement = element.querySelector('.date')
      if (!dateElement?.getAttribute('title'))
        return null

      const date = parseTelegramDate(dateElement.getAttribute('title')!)

      // Get reply info
      const replyElement = element.querySelector('.reply_to')
      const replyToId = replyElement
        ? Number(replyElement.getAttribute('href')?.replace('#go_to_message', ''))
        : undefined

      // Get forward info
      const forwardElement = element.querySelector('.forwarded')
      const forwardFromChatId = forwardElement
        ? Number(forwardElement.getAttribute('data-peer-id'))
        : undefined
      const forwardFromMessageId = forwardElement
        ? Number(forwardElement.getAttribute('data-peer-message'))
        : undefined

      // Get message stats
      const viewsElement = element.querySelector('.views')
      const views = viewsElement
        ? Number(viewsElement.textContent?.trim())
        : undefined

      const forwardsElement = element.querySelector('.forwards')
      const forwards = forwardsElement
        ? Number(forwardsElement.textContent?.trim())
        : undefined

      return {
        id,
        chatId: 0, // Will be set later
        type: getMessageType(element),
        content: text,
        createdAt: date,
        fromId: fromId ? Number(fromId) : undefined,
        fromName,
        fromAvatar,
        links: links.length > 0 ? links : undefined,
        replyToId,
        forwardFromChatId,
        forwardFromMessageId,
        views,
        forwards,
        mediaInfo: extractMediaInfo(element),
      } as MessageData
    })
    .filter((message): message is MessageData => message !== null)
}
