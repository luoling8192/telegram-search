import type { ITelegramBotAdapter, TelegramMessage, TelegramMessageType } from './types'

import { useLogger } from '@tg-search/common'
import { getMessageStats } from '@tg-search/db'
import { Bot, GrammyError, HttpError } from 'grammy'

export class BotAdapter implements ITelegramBotAdapter {
  private bot: Bot
  private messageCallback?: (message: TelegramMessage) => Promise<void>
  private logger = useLogger('bot')

  constructor(token: string) {
    this.bot = new Bot(token)

    // Error handling
    this.bot.catch((err) => {
      const ctx = err.ctx
      this.logger.withError(err.error).error(`Error while handling update ${ctx.update.update_id}:`)
      const e = err.error
      if (e instanceof GrammyError) {
        this.logger.withError(e).error('Error in request:')
      }
      else if (e instanceof HttpError) {
        this.logger.withError(e).error('Could not contact Telegram:')
      }
      else {
        this.logger.withError(e).error('Unknown error:')
      }
    })

    // Setup commands
    this.bot.command('start', ctx => ctx.reply(
      '你好！我是一个消息存档机器人。\n'
      + '请把我加入群组并设置为管理员，我就会开始记录消息。\n'
      + '支持的命令：\n'
      + '/stats - 显示当前群组的消息统计',
    ))

    this.bot.command('stats', async (ctx) => {
      const chatId = ctx.chat.id
      try {
        const msg = await ctx.reply('正在统计...')
        const stats = await getMessageStats(chatId)

        if (!stats) {
          await ctx.api.editMessageText(
            ctx.chat.id,
            msg.message_id,
            '暂无消息记录',
          )
          return
        }

        const typeStats = [
          `文本消息: ${stats.text_count}`,
          `图片: ${stats.photo_count}`,
          `视频: ${stats.video_count}`,
          `文档: ${stats.document_count}`,
          `贴纸: ${stats.sticker_count}`,
          `其他: ${stats.other_count}`,
        ].join('\n')

        await ctx.api.editMessageText(
          ctx.chat.id,
          msg.message_id,
          `📊 消息统计\n\n`
          + `总消息数：${stats.message_count}\n\n`
          + `类型统计：\n${typeStats}\n\n`
          + `最后一条消息：${stats.last_message || '无'}\n`
          + `最后更新时间：${stats.last_message_date?.toLocaleString() || '无'}`,
        )
      }
      catch (error) {
        this.logger.withError(error).error('Error getting stats:')
        await ctx.reply('获取统计信息失败')
      }
    })
  }

  get type() {
    return 'bot' as const
  }

  /**
   * Convert message type from Grammy to our type
   */
  private getMessageType(message: any): TelegramMessageType {
    if (message.text)
      return 'text'
    if (message.photo)
      return 'photo'
    if (message.video)
      return 'video'
    if (message.document)
      return 'document'
    return 'other'
  }

  /**
   * Convert message from Grammy to our format
   */
  private convertMessage(message: any): TelegramMessage {
    return {
      id: message.message_id,
      chatId: message.chat.id,
      type: this.getMessageType(message),
      content: message.text || message.caption,
      fromId: message.from?.id,
      replyToId: message.reply_to_message?.message_id,
      forwardFromChatId: message.forward_from_chat?.id,
      forwardFromMessageId: message.forward_from_message_id,
      views: message.views,
      forwards: message.forwards,
      createdAt: new Date(message.date * 1000),
    }
  }

  async connect() {
    this.logger.log('Setting up bot handlers...')

    // Setup message handler for all types of messages
    this.bot.on(['message', 'edited_message'], async (ctx) => {
      const message = ctx.message || ctx.editedMessage
      if (!message)
        return

      this.logger.log(`Received message from chat ${ctx.chat.id} (${ctx.chat.type}):`, message)

      if (this.messageCallback) {
        try {
          const convertedMessage = this.convertMessage(message)
          await this.messageCallback(convertedMessage)
        }
        catch (error) {
          this.logger.withError(error).error('Error handling message:')
        }
      }
    })

    // Start the bot
    this.logger.log('Starting bot...')
    try {
      await this.bot.start({
        onStart: (botInfo) => {
          this.logger.log('Bot started as:', botInfo.username)
        },
      })
    }
    catch (error) {
      this.logger.withError(error).error('Failed to start bot:')
      throw error
    }
  }

  async disconnect() {
    await this.bot.stop()
  }

  async *getMessages(_chatId: number, _limit = 100): AsyncGenerator<TelegramMessage> {
    // Note: Bot API doesn't support getting message history
    // We can only get messages that are sent to the bot
    throw new Error('Bot API does not support getting message history')
  }

  onMessage(callback: (message: TelegramMessage) => Promise<void>) {
    this.messageCallback = callback
  }
}
