import type { TelegramClient } from 'telegram'
import type { MediaService } from '../../services/media'
import type { TelegramMessage, TelegramMessageType } from '../types'

import { useLogger } from '@tg-search/common'
import { Api } from 'telegram'

import { EntityResolver } from './entity-resolver'
import { UserResolver } from './user-resolver'

/**
 * Handles conversion of Telegram messages to internal format
 */
export class MessageConverter {
  private logger = useLogger('message-converter')
  private userResolver: UserResolver

  constructor(
    private readonly mediaService: MediaService,
    private readonly client: TelegramClient,
  ) {
    this.userResolver = new UserResolver(client)
  }

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

    // Extract links from message
    const links = message.message?.match(/https?:\/\/\S+/g) || undefined

    // Get sender info
    let fromId: number | undefined
    let fromName: string | undefined

    if (message.fromId instanceof Api.PeerUser) {
      fromId = message.fromId.userId.toJSNumber()
      const userInfo = await this.userResolver.resolveUser(fromId)
      if (userInfo) {
        fromName = userInfo.displayName
      }
    }

    // Get forward info
    let forwardFromChatId: number | undefined
    let forwardFromChatName: string | undefined

    if (message.fwdFrom?.fromId instanceof Api.PeerChannel) {
      forwardFromChatId = message.fwdFrom.fromId.channelId.toJSNumber()
      try {
        const forwardChat = await this.client.getEntity(message.fwdFrom.fromId)
        if (forwardChat instanceof Api.Channel) {
          forwardFromChatName = forwardChat.title
        }
      }
      catch (error) {
        // Ignore errors when getting forward chat info
        // This is expected for private channels we don't have access to
        this.logger.withFields({
          chatId: forwardFromChatId,
          error: error instanceof Error ? error.message : String(error),
          isPrivateChannel: error instanceof Error && error.message.includes('CHANNEL_PRIVATE'),
        }).debug('Failed to get forward chat info')
      }
    }

    return {
      id: message.id,
      chatId: EntityResolver.getPeerId(message.peerId),
      type,
      content: message.message,
      mediaInfo,
      fromId,
      fromName,
      replyToId: message.replyTo?.replyToMsgId,
      forwardFromChatId,
      forwardFromChatName,
      forwardFromMessageId: message.fwdFrom?.channelPost,
      views: message.views,
      forwards: message.forwards,
      links,
      metadata: {
        hasLinks: !!links?.length,
        hasMedia: !!mediaInfo,
        isForwarded: !!message.fwdFrom,
        isReply: !!message.replyTo,
      },
      createdAt: new Date(message.date * 1000),
    }
  }
}
