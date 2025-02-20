import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import process from 'node:process'

/**
 * Resolve home directory in path
 */
export function resolveHomeDir(dir: string): string {
  if (dir.startsWith('~/')) {
    return path.join(os.homedir(), dir.slice(2))
  }
  return dir
}

/**
 * Find root package directory by looking for package.json
 */
export function findRootPackage(startDir: string = process.cwd()): string {
  let currentDir = startDir

  while (currentDir !== path.parse(currentDir).root) {
    const packagePath = path.join(currentDir, 'package.json')
    if (fs.existsSync(packagePath)) {
      return currentDir
    }
    currentDir = path.dirname(currentDir)
  }

  throw new Error('Could not find root package directory')
}

/**
 * Find config directory by looking for config/config.yaml
 */
export function findConfigDir(startDir: string = process.cwd()): string {
  let currentDir = startDir

  while (currentDir !== path.parse(currentDir).root) {
    const configPath = path.join(currentDir, 'config', 'config.yaml')
    if (fs.existsSync(configPath)) {
      return path.join(currentDir, 'config')
    }
    currentDir = path.dirname(currentDir)
  }

  throw new Error('Could not find config directory')
}
