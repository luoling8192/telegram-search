import type { TelegramClient } from 'telegram'
import type { MediaInfo } from '../db'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { useLogger } from '@tg-search/common'

import { getConfig } from '../composable/config'

export class MediaService {
  private client: TelegramClient
  private mediaDir: string
  private logger = useLogger()

  constructor(client: TelegramClient) {
    this.client = client
    const appConfig = getConfig()
    this.mediaDir = appConfig.mediaPath
  }

  /**
   * Initialize media directory
   */
  async init() {
    try {
      await fs.mkdir(this.mediaDir, { recursive: true })
    }
    catch (error) {
      this.logger.log('Failed to create media directory:', String(error))
    }
  }

  /**
   * Get media info from message
   */
  getMediaInfo(message: any): MediaInfo | undefined {
    if (message.media) {
      const media = message.media
      const type = this.getMediaType(media)
      if (!type)
        return undefined

      const info: MediaInfo = {
        fileId: media.id?.toString() || '',
        type,
      }

      // Add common properties
      if ('mimeType' in media)
        info.mimeType = media.mimeType
      if ('size' in media)
        info.fileSize = media.size
      if ('fileName' in media)
        info.fileName = media.fileName

      // Add image/video specific properties
      if ('w' in media && 'h' in media) {
        info.width = media.w
        info.height = media.h
      }
      if ('duration' in media) {
        info.duration = media.duration
      }

      // Add thumbnail info
      if (media.thumb) {
        info.thumbnail = {
          fileId: media.thumb.id?.toString() || '',
          width: media.thumb.w,
          height: media.thumb.h,
        }
      }

      return info
    }
    return undefined
  }

  /**
   * Get media type from message
   */
  private getMediaType(media: any): string | undefined {
    if ('photo' in media)
      return 'photo'
    if ('document' in media)
      return 'document'
    if ('video' in media)
      return 'video'
    if ('sticker' in media)
      return 'sticker'
    return undefined
  }

  /**
   * Download media file
   */
  async downloadMedia(message: any, info: MediaInfo): Promise<string | undefined> {
    try {
      // Create subdirectory for each type
      const typeDir = path.join(this.mediaDir, info.type)
      await fs.mkdir(typeDir, { recursive: true })

      // Generate file name
      const ext = this.getFileExtension(info)
      const fileName = `${message.id}${ext}`
      const filePath = path.join(typeDir, fileName)

      // Download file
      await this.client.downloadMedia(message.media, {
        outputFile: filePath,
      })

      // Return relative path
      return path.relative(process.cwd(), filePath)
    }
    catch (error) {
      this.logger.log('Failed to download media:', String(error))
      return undefined
    }
  }

  /**
   * Get file extension from media info
   */
  private getFileExtension(info: MediaInfo): string {
    if (info.fileName) {
      return path.extname(info.fileName)
    }
    if (info.mimeType) {
      switch (info.mimeType) {
        case 'image/jpeg':
          return '.jpg'
        case 'image/png':
          return '.png'
        case 'image/gif':
          return '.gif'
        case 'video/mp4':
          return '.mp4'
        case 'application/x-tgsticker':
          return '.tgs'
        default:
          return ''
      }
    }
    return ''
  }
}
