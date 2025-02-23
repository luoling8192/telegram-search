import type { Config } from '@tg-search/common'

import { ref } from 'vue'

import { apiFetch } from '../composables/api'

/**
 * Vue composable for managing config state and operations
 */
export function useConfig() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const config = ref<Config | null>(null)

  /**
   * Get current config
   */
  async function getConfig(): Promise<Config> {
    loading.value = true
    error.value = null

    try {
      const response = await apiFetch<{ success: boolean, data: Config }>('/config')
      if (!response.success) {
        throw new Error('Failed to fetch config')
      }
      config.value = response.data
      return response.data
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      throw err
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Update config
   */
  async function updateConfig(newConfig: Config): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await apiFetch<{ success: boolean }>('/config', {
        method: 'PUT',
        body: newConfig,
      })
      if (!response.success) {
        throw new Error('Failed to update config')
      }
      config.value = newConfig
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      throw err
    }
    finally {
      loading.value = false
    }
  }

  return {
    config,
    loading,
    error,
    getConfig,
    updateConfig,
  }
}
