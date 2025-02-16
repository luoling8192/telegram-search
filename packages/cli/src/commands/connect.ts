import type { TelegramAdapter } from '@tg-search/core'
import type { Command } from '../command'

import * as input from '@inquirer/prompts'
import { getConfig, useLogger } from '@tg-search/common'
import { createAdapter } from '@tg-search/core'

const logger = useLogger()

/**
 * Connect command to handle Telegram login
 */
export class ConnectCommand implements Command {
  private client?: TelegramAdapter

  meta = {
    name: 'connect',
    description: '连接到 Telegram 账号',
    usage: '[options]',
  }

  setClient(client: TelegramAdapter) {
    this.client = client
  }

  async execute(_args: string[], _options: Record<string, any>): Promise<void> {
    try {
      // Create client if not provided
      if (!this.client) {
        const config = getConfig()
        this.client = await createAdapter({
          type: 'client',
          apiId: Number(config.apiId),
          apiHash: config.apiHash,
          phoneNumber: config.phoneNumber,
        })
      }

      // Connect to Telegram
      logger.log('正在连接到 Telegram...')
      try {
        await this.client.connect()
        logger.log('连接成功')
      }
      catch (error) {
        if (!this.client) {
          throw new Error('Client not initialized')
        }

        if (error instanceof Error && error.message === 'Code is required') {
          // Need verification code
          logger.log('需要验证码')
          const code = await input.input({ message: '请输入你收到的验证码：' })
          if (!code) {
            throw new Error('需要验证码')
          }

          try {
            await this.client.connect({ code })
            logger.log('连接成功')
            return
          }
          catch (error) {
            if (error instanceof Error && error.message === '2FA password is required') {
              // Need 2FA password
              logger.log('需要两步验证密码')
              const password = await input.password({ message: '请输入两步验证密码：' })
              if (!password) {
                throw new Error('需要两步验证密码')
              }

              await this.client.connect({ code, password })
              logger.log('连接成功')
              return
            }
            throw error
          }
        }
        throw error
      }
    }
    catch (error) {
      logger.withError(error).error('连接失败')
      throw error
    }
  }
}

// Register command
export default new ConnectCommand()
