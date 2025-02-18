import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'

export type Logger = ReturnType<typeof useLogg>

export function initLogger() {
  setGlobalLogLevel(LogLevel.Debug)
  setGlobalFormat(Format.Pretty)

  const logger = useLogg('logger').useGlobalConfig()
  logger.log('Logger initialized')
}

/**
 * Get logger instance with directory name and filename
 * @returns logger instance configured with "directoryName/filename"
 */
export function useLogger(name?: string) {
  // If name is provided, use it directly
  if (name)
    return useLogg(name).useGlobalConfig()

  const stack = new Error('logger').stack
  const caller = stack?.split('\n')[2]

  // Match the parent directory and filename without extension
  const match = caller?.match(/\/([^/]+)\/([^/]+?)\.[jt]s/)
  const dirName = match?.[1] || 'unknown'
  const fileName = match?.[2] || 'unknown'

  const logger = useLogg(`${dirName}/${fileName}`).useGlobalConfig()

  // Add alias for logger.log with fields
  const originalLog = logger.log.bind(logger)
  logger.log = (message: string, fields?: Record<string, unknown>) => {
    if (fields) {
      return logger.withFields(fields).log(message)
    }
    return originalLog(message)
  }
  // Add alias for logger.info to use logger.log
  ;(logger as any).info = logger.log

  return logger
}
