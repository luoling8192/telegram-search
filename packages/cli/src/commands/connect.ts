import { useLogger } from '@tg-search/common'

import { TelegramCommand } from '../command'

const logger = useLogger()

/**
 * Connect command to test Telegram connection
 */
export class ConnectCommand extends TelegramCommand {
  meta = {
    name: 'connect',
    description: 'Test Telegram connection',
    requiresConnection: true,
  }

  async execute(_args: string[], _options: Record<string, any>): Promise<void> {
    logger.log('连接测试成功')
  }
}

// Register command
export default new ConnectCommand()
