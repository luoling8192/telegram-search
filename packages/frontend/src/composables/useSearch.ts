import type { SearchRequest, SearchResultItem } from '@tg-search/server/types'
import type { ApiResponse } from '@tg-search/server/utils/response'

import { ref } from 'vue'
import { toast } from 'vue-sonner'

// API base URL with fallback
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

/**
 * Parse SSE response data
 */
function parseSSEData<T>(data: string): ApiResponse<T> {
  try {
    // Ensure data is properly trimmed
    const trimmedData = data.trim()
    if (!trimmedData) {
      throw new Error('Empty data')
    }
    return JSON.parse(trimmedData)
  }
  catch (error) {
    // Log parsing error for debugging
    console.error('SSE data parsing error:', error, 'Data:', data)
    // If data is a plain string (like info messages), wrap it
    return {
      success: true,
      data: data as T,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Search API function with SSE support
 */
async function searchAPI(params: SearchRequest, signal: AbortSignal, callbacks: {
  onInfo: (info: string) => void
  onPartial: (items: SearchResultItem[], total: number) => void
  onFinal: (items: SearchResultItem[], total: number) => void
  onError: (error: Error) => void
}) {
  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(params),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break

    // 添加新数据到缓冲区
    buffer += decoder.decode(value, { stream: true })

    // 处理完整的消息
    const messages = buffer.split('\n\n')
    // 保留最后一个不完整的消息
    buffer = messages.pop() || ''

    for (const message of messages) {
      if (!message.trim())
        continue

      // 解析事件和数据
      const lines = message.split('\n')
      const eventLine = lines.find(line => line.startsWith('event:'))
      const dataLine = lines.find(line => line.startsWith('data:'))

      if (!eventLine || !dataLine)
        continue

      const eventType = eventLine.slice(6).trim()
      const data = dataLine.slice(5).trim()

      try {
        switch (eventType) {
          case 'info': {
            const response = parseSSEData<string>(data)
            callbacks.onInfo(response.success ? response.data : response.error)
            break
          }
          case 'partial': {
            const response = parseSSEData<{ total: number, items: SearchResultItem[] }>(data)
            if (response.success) {
              callbacks.onPartial(response.data.items, response.data.total)
            }
            else {
              callbacks.onError(new Error(response.error))
            }
            break
          }
          case 'final': {
            const response = parseSSEData<{ total: number, items: SearchResultItem[] }>(data)
            if (response.success) {
              callbacks.onFinal(response.data.items, response.data.total)
            }
            else {
              callbacks.onError(new Error(response.error))
            }
            break
          }
          case 'error': {
            const response = parseSSEData<never>(data)
            callbacks.onError(new Error(response.success ? 'Unknown error' : response.error))
            break
          }
        }
      }
      catch (error) {
        console.error('Error processing SSE message:', error)
        callbacks.onError(error instanceof Error ? error : new Error('Failed to process SSE message'))
      }
    }
  }
}

/**
 * Search composable for managing search state and functionality
 */
export function useSearch() {
  // Search state
  const query = ref('')
  const isLoading = ref(false)
  const results = ref<SearchResultItem[]>([])
  const total = ref(0)
  const error = ref<Error | null>(null)

  // Search parameters
  const currentPage = ref(1)
  const pageSize = ref(20)
  const currentChatId = ref<number | undefined>()
  const currentFolderId = ref<number | undefined>()

  // Stream state
  const isStreaming = ref(false)
  const streamController = ref<AbortController | null>(null)
  const searchProgress = ref<string[]>([])

  /**
   * Execute search with current parameters
   */
  async function search(params?: Partial<SearchRequest>) {
    if (!query.value.trim() && !params?.query)
      return

    // Cancel previous stream if exists
    if (streamController.value) {
      streamController.value.abort()
    }

    // Update search scope if provided
    if (params?.chatId !== undefined) {
      currentChatId.value = params.chatId
    }
    if (params?.folderId !== undefined) {
      currentFolderId.value = params.folderId
    }

    isLoading.value = true
    isStreaming.value = true
    error.value = null
    searchProgress.value = []
    streamController.value = new AbortController()

    // Show loading toast
    const toastId = toast.loading('正在搜索...')

    try {
      await searchAPI({
        query: params?.query || query.value,
        offset: params?.offset || (currentPage.value - 1) * pageSize.value,
        limit: params?.limit || pageSize.value,
        folderId: currentFolderId.value,
        chatId: currentChatId.value,
      }, streamController.value.signal, {
        onInfo: (info) => {
          searchProgress.value.push(info)
        },
        onPartial: (items, newTotal) => {
          results.value = items
          total.value = newTotal
          // Update loading toast
          toast.loading(`找到 ${newTotal} 条结果，继续搜索中...`, {
            id: toastId,
          })
        },
        onFinal: (items, newTotal) => {
          results.value = items
          total.value = newTotal
          isStreaming.value = false
          // Show success toast
          toast.success(`搜索完成，共找到 ${newTotal} 条结果`, {
            id: toastId,
          })
        },
        onError: (err) => {
          error.value = err
          isStreaming.value = false
          // Show error toast
          toast.error(`搜索失败: ${err.message}`, {
            id: toastId,
          })
        },
      })
    }
    catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 忽略取消的请求
        toast.dismiss(toastId)
        return
      }
      error.value = err as Error
      console.error('Search failed:', err)
      // Show error toast
      toast.error(`搜索失败: ${err instanceof Error ? err.message : '未知错误'}`, {
        id: toastId,
      })
    }
    finally {
      isLoading.value = false
      streamController.value = null
    }
  }

  /**
   * Handle page change
   */
  function changePage(page: number) {
    currentPage.value = page
    return search()
  }

  /**
   * Reset search state
   */
  function reset() {
    query.value = ''
    results.value = []
    total.value = 0
    currentPage.value = 1
    currentChatId.value = undefined
    currentFolderId.value = undefined
    error.value = null
    searchProgress.value = []

    if (streamController.value) {
      streamController.value.abort()
      streamController.value = null
    }
  }

  return {
    // State
    query,
    isLoading,
    isStreaming,
    results,
    total,
    error,
    currentPage,
    pageSize,
    searchProgress,
    currentChatId,
    currentFolderId,

    // Methods
    search,
    changePage,
    reset,
  }
}
