import type { ApiResponse, SearchRequest, SearchResultItem } from '@tg-search/server/types'

import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { createSSEConnection } from '../composables/sse'

interface SearchResponse {
  total: number
  items: SearchResultItem[]
}

interface SearchCompleteResponse {
  duration: number
  total: number
}

type LocalSearchEventData = SearchResponse | SearchCompleteResponse

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
  const useVectorSearch = ref(false)

  // Stream state
  const isStreaming = ref(false)
  const streamController = ref<AbortController | null>(null)
  const searchProgress = ref<string[]>([])
  const isConnected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 5000

  // Store last search params for reconnection
  const lastSearchParams = ref<SearchRequest | null>(null)

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

    // Store search params for reconnection
    lastSearchParams.value = {
      query: params?.query || query.value,
      offset: params?.offset || (currentPage.value - 1) * pageSize.value,
      limit: params?.limit || pageSize.value,
      folderId: currentFolderId.value,
      chatId: currentChatId.value,
      useVectorSearch: useVectorSearch.value,
    } as SearchRequest

    // Show loading toast
    const toastId = toast.loading('正在搜索...')

    try {
      await createSSEConnection<LocalSearchEventData>('/search', lastSearchParams.value as unknown as Record<string, unknown>, {
        onInfo: (info: string) => {
          searchProgress.value.push(info)
          isConnected.value = true
          reconnectAttempts.value = 0
          toast.loading(info, { id: toastId })
        },
        onUpdate: (response: ApiResponse<LocalSearchEventData>) => {
          if (!response.success || !response.data || !('items' in response.data))
            return

          const { items, total: newTotal } = response.data
          results.value = items
          total.value = newTotal

          // Update loading toast
          toast.loading(`找到 ${newTotal} 条结果，继续搜索中...`, {
            id: toastId,
          })
        },
        onComplete: (response: ApiResponse<LocalSearchEventData>) => {
          isStreaming.value = false
          isConnected.value = false
          if (response.success && response.data && 'duration' in response.data) {
            toast.success(`搜索完成，共找到 ${total.value} 条结果，耗时 ${response.data.duration}ms`, {
              id: toastId,
            })
          }
          else {
            toast.success(`搜索完成，共找到 ${total.value} 条结果`, {
              id: toastId,
            })
          }
        },
        onError: (err: Error) => {
          error.value = err
          isStreaming.value = false
          isConnected.value = false
          toast.error(`搜索失败: ${err.message}`, { id: toastId })

          // Try to reconnect if not exceeded max attempts
          if (reconnectAttempts.value < maxReconnectAttempts) {
            reconnectAttempts.value++
            const delay = reconnectDelay * reconnectAttempts.value
            toast.error(`搜索服务连接失败，${delay / 1000} 秒后重试...`)
            setTimeout(() => {
              if (lastSearchParams.value) {
                search(lastSearchParams.value)
              }
            }, delay)
          }
          else {
            toast.error('搜索服务连接失败，请刷新页面重试')
          }
        },
      }, streamController.value.signal)
    }
    catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 忽略取消的请求
        toast.dismiss(toastId)
        return
      }
      error.value = err as Error
      isStreaming.value = false
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
    useVectorSearch.value = false
    error.value = null
    searchProgress.value = []
    isConnected.value = false
    reconnectAttempts.value = 0
    lastSearchParams.value = null

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
    useVectorSearch,
    isConnected,

    // Methods
    search,
    changePage,
    reset,
  }
}
