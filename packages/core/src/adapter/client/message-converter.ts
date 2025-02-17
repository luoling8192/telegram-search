import type { MediaService } from '../../services/media'
import type { TelegramMessage, TelegramMessageType } from '../types'

import { Api } from 'telegram'

import { EntityResolver } from './entity-resolver'

/**
 * Handles conversion of Telegram messages to internal format
 */
export class MessageConverter {
  constructor(
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Convert message type from Telegram to internal type
   */
  private getMessageType(message: Api.Message): TelegramMessageType {
    if (message.media) {
      if ('photo' in message.media)
        return 'photo'
      if ('document' in message.media)
        return 'document'
      if ('video' in message.media)
        return 'video'
      if ('sticker' in message.media)
        return 'sticker'
      return 'other'
    }
    if (message.message)
      return 'text'
    return 'other'
  }

  /**
   * Convert message from Telegram to internal format
   */
  async convertMessage(message: Api.Message, skipMedia = false): Promise<TelegramMessage> {
    const type = this.getMessageType(message)
    let mediaInfo

    if (message.media && !skipMedia) {
      const downloadedMediaInfo = this.mediaService.getMediaInfo(message)
      if (downloadedMediaInfo) {
        const localPath = await this.mediaService.downloadMedia(
          message,
          downloadedMediaInfo,
        )
        if (localPath) {
          downloadedMediaInfo.localPath = localPath
        }
        mediaInfo = downloadedMediaInfo
      }
    }

    return {
      id: message.id,
      chatId: EntityResolver.getPeerId(message.peerId),
      type,
      content: message.message,
      mediaInfo,
      fromId: (message.fromId instanceof Api.PeerUser) ? message.fromId.userId.toJSNumber() : undefined,
      replyToId: message.replyTo?.replyToMsgId,
      forwardFromChatId: (message.fwdFrom?.fromId instanceof Api.PeerChannel)
        ? message.fwdFrom.fromId.channelId.toJSNumber()
        : undefined,
      forwardFromMessageId: message.fwdFrom?.channelPost,
      views: message.views,
      forwards: message.forwards,
      createdAt: new Date(message.date * 1000),
    }
  }
}
