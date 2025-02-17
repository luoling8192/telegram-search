import type { Entity } from 'telegram/define'

import { Api } from 'telegram'

/**
 * Handles resolution of Telegram entity types and information
 */
export class EntityResolver {
  /**
   * Get entity type and name from a Telegram entity
   */
  static getEntityInfo(entity: Entity | undefined): { type: 'user' | 'group' | 'channel', name: string } {
    if (!entity) {
      return { type: 'user', name: 'Unknown' }
    }

    if (entity instanceof Api.User) {
      return {
        type: 'user',
        name: [entity.firstName, entity.lastName].filter(Boolean).join(' ')
          || entity.username
          || 'Unknown User',
      }
    }

    if (entity instanceof Api.Chat || entity instanceof Api.Channel) {
      return {
        type: entity instanceof Api.Channel
          ? (entity.megagroup ? 'group' : 'channel')
          : 'group',
        name: entity.title,
      }
    }

    return { type: 'user', name: 'Unknown' }
  }

  /**
   * Get chat type from Telegram chat object
   */
  static getChatType(chat: any): 'user' | 'group' | 'channel' | 'saved' {
    if (chat.className === 'Channel') {
      return chat.megagroup ? 'group' : 'channel'
    }
    if (chat.className === 'Chat') {
      return 'group'
    }
    if (chat.className === 'User') {
      return 'self' in chat && chat.self ? 'saved' : 'user'
    }
    return 'group'
  }

  /**
   * Get peer ID from a Telegram peer object
   */
  static getPeerId(peer: Api.TypePeer): number {
    if (peer instanceof Api.PeerUser)
      return peer.userId.toJSNumber()
    if (peer instanceof Api.PeerChat)
      return peer.chatId.toJSNumber()
    if (peer instanceof Api.PeerChannel)
      return peer.channelId.toJSNumber()
    return 0
  }
}
