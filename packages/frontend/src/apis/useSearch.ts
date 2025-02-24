import type { ApiResponse, SearchRequest, SearchResultItem } from '@tg-search/server/types'

import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { useSSE } from '../composables/sse'

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
  const results = ref<SearchResultItem[]>([])
  const total = ref(0)
  const error = ref<Error | null>(null)

  // Search parameters
  const currentPage = ref(1)
  const pageSize = ref(20)
  const currentChatId = ref<number | undefined>()
  const currentFolderId = ref<number | undefined>()
  const useVectorSearch = ref(false)

  // Store last search params for reconnection
  const lastSearchParams = ref<SearchRequest | null>(null)

  // Initialize SSE
  const {
    loading: isLoading,
    error: sseError,
    isConnected,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectDelay,
    createConnection,
  } = useSSE<LocalSearchEventData>()

  // Search progress state
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
      await createConnection('/search', lastSearchParams.value, {
        onInfo: (info: string) => {
          searchProgress.value.push(info)
          toast.loading(info, { id: toastId })
        },
        onUpdate: (response: ApiResponse<LocalSearchEventData>) => {
          if (!response.success || !response.data)
            return

          if (isSearchResponse(response.data)) {
            results.value = response.data.items
            total.value = response.data.total
            toast.loading(`找到 ${total.value} 条结果，继续搜索中...`, { id: toastId })
          }
        },
        onComplete: (response: ApiResponse<LocalSearchEventData>) => {
          isStreaming.value = false
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
          toast.error(`搜索失败: ${err.message}`, { id: toastId })

          // Try to reconnect if not exceeded max attempts
          if (reconnectAttempts.value < maxReconnectAttempts) {
            const delay = reconnectDelay() * reconnectAttempts.value
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
      })
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
    lastSearchParams.value = null

    if (streamController.value) {
      streamController.value.abort()
      streamController.value = null
    }
  }

  // 添加类型保护
  function isSearchResponse(data: LocalSearchEventData): data is SearchResponse {
    return 'items' in data && 'total' in data
  }

  return {
    // State
    query,
    isLoading,
    isStreaming,
    results,
    total,
    error: error || sseError,
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
