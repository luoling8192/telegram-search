/// <reference types="vite/client" />

import type { ErrorResponse, PaginatedResponse, PaginationParams, PublicChat, PublicFolder, PublicMessage, SearchRequest, SearchResponse } from '@tg-search/server/types'

/**
 * Base API configuration
 */
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

/**
 * API error class
 */
export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message)
  }
}

/**
 * Search messages in the database
 */
export async function searchMessages(params: SearchRequest): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  const data = await response.json()
  if (!response.ok) {
    const error = data as ErrorResponse
    throw new APIError(error.error, error.code, error.status)
  }

  return data as SearchResponse
}

/**
 * Get all chats
 */
export async function getChats(): Promise<PublicChat[]> {
  const response = await fetch(`${API_BASE}/chats`)
  const data = await response.json()
  if (!response.ok) {
    const error = data as ErrorResponse
    throw new APIError(error.error, error.code, error.status)
  }

  return data
}

/**
 * Get messages in chat
 */
export async function getMessages(chatId: number, params?: PaginationParams): Promise<{
  items: PublicMessage[]
  total: number
  limit: number
  offset: number
}> {
  const url = new URL(`${API_BASE}/messages/${chatId}`)
  if (params?.limit)
    url.searchParams.set('limit', params.limit.toString())
  if (params?.offset)
    url.searchParams.set('offset', params.offset.toString())

  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) {
    const error = data as ErrorResponse
    throw new APIError(error.error, error.code, error.status)
  }

  return data
}

/**
 * Get all folders
 */
export async function getFolders(): Promise<PublicFolder[]> {
  const response = await fetch(`${API_BASE}/folders`)
  const data = await response.json()
  if (!response.ok) {
    const error = data as ErrorResponse
    throw new APIError(error.error, error.code, error.status)
  }

  return data
}
