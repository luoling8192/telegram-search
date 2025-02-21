import type { Command, CommandStore, CommandType } from '../types/command'

/**
 * In-memory command store implementation
 */
export class InMemoryCommandStore implements CommandStore {
  private commands = new Map<string, Command>()

  get(id: string): Command | undefined {
    return this.commands.get(id)
  }

  getAll(): Command[] {
    return Array.from(this.commands.values())
  }

  create(type: CommandType): Command {
    const id = Math.random().toString(36).substring(7)
    const command: Command = {
      id,
      type,
      status: 'idle',
      progress: 0,
      message: 'Command created',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.commands.set(id, command)
    return command
  }

  update(id: string, updates: Partial<Command>): void {
    const command = this.commands.get(id)
    if (!command) {
      throw new Error(`Command ${id} not found`)
    }
    Object.assign(command, updates, { updatedAt: new Date() })
    this.commands.set(id, command)
  }

  delete(id: string): void {
    this.commands.delete(id)
  }
}
