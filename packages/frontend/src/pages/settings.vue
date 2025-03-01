<!-- Settings page -->
<script setup lang="ts">
import type { Config } from '@tg-search/common'
import { ref } from 'vue'
import { toast, Toaster } from 'vue-sonner'
import { useConfig } from '../apis/useConfig'
import SelectDropdown from '../components/ui/SelectDropdown.vue'

// Initialize config composable
const { config, loading, error, getConfig, updateConfig } = useConfig()

const isEditing = ref(false)
const validationError = ref<string | null>(null)

//
// 数字类型字段的验证函数
function validateNumberField(value: number, fieldName: string, min = 1, max = 1000): string | null {
  if (Number.isNaN(value)) {
    return `${fieldName} must be a valid number`
  }
  if (value < min) {
    return `${fieldName} must be at least ${min}`
  }
  if (value > max) {
    return `${fieldName} must be less than ${max}`
  }
  return null
}

const embeddingProviderOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Ollama', value: 'ollama' },
]

// 验证所有数字字段
function validateConfig(config: Config): string | null {
  const fields = [
    { value: config.message.export.batchSize, name: 'Batch Size', max: 1000 },
    { value: config.message.export.concurrent, name: 'Concurrent Requests', max: 10 },
    { value: config.message.export.retryTimes, name: 'Retry Times', max: 10 },
    { value: config.message.export.maxTakeoutRetries, name: 'Max Takeout Retries', max: 10 },
  ]

  for (const field of fields) {
    const error = validateNumberField(field.value, field.name, 1, field.max)
    if (error)
      return error
  }

  return null
}

// 处理数字输入
function handleNumberInput(event: Event, path: string[]) {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)

  if (!config.value)
    return

  // 使用 lodash 的 get 和 set 来安全地访问和修改嵌套属性
  let target = config.value
  for (let i = 0; i < path.length - 1; i++) {
    target = target[path[i] as keyof typeof target] as any
  }

  const lastKey = path[path.length - 1]
  target[lastKey as keyof typeof target] = value as any

  // 验证新值
  validationError.value = validateNumberField(value, lastKey)
}

// 加载配置
async function loadConfig() {
  try {
    await getConfig()
  }
  catch (err) {
    console.error('Failed to load config:', err)
    toast.error(`Failed to load config: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

// 保存配置
async function saveConfig() {
  if (!config.value)
    return

  try {
    // 确保所有数字字段的类型正确
    const safeConfig: Config = {
      ...config.value,
      database: {
        ...config.value.database,
        port: Number(config.value.database.port),
      },
      message: {
        export: {
          batchSize: Number(config.value.message.export.batchSize),
          concurrent: Number(config.value.message.export.concurrent),
          retryTimes: Number(config.value.message.export.retryTimes),
          maxTakeoutRetries: Number(config.value.message.export.maxTakeoutRetries),
        },
        batch: {
          size: Number(config.value.message.batch.size),
        },
      },
    }

    // 验证配置
    const configValidationError = validateConfig(safeConfig)
    if (configValidationError) {
      toast.error(configValidationError)
      return
    }

    await updateConfig(safeConfig)
    isEditing.value = false
    toast.success('Settings saved successfully')

    // 修复：确保 validationError 存在再设置
    if (validationError.value && validationError.value !== undefined)
      validationError.value = null
  }
  catch (err) {
    console.error('Failed to save config:', err)
    toast.error(`Failed to save config: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

// 重置配置
function resetConfig() {
  isEditing.value = false
  // 修复：确保 validationError 存在再设置
  if (validationError.value && validationError.value !== undefined)
    validationError.value = null

  loadConfig()
  toast('Settings reset to last saved state')
}

// 加载初始配置
loadConfig()
</script>

<template>
  <div class="mx-auto p-4 container space-y-6">
    <Toaster position="top-right" rich-colors />
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold dark:text-white">
        Settings
      </h1>
      <div class="space-x-2">
        <button
          v-if="!isEditing"
          class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          @click="isEditing = true"
        >
          Edit
        </button>
        <template v-else>
          <button
            class="rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
            @click="resetConfig"
          >
            Cancel
          </button>
          <button
            class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            @click="saveConfig"
          >
            Save
          </button>
        </template>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center text-gray-500 dark:text-gray-400">
      Loading settings...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center text-red-500 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Validation error -->
    <div v-if="validationError" class="mt-2 text-sm text-red-500">
      {{ validationError }}
    </div>

    <!-- Settings form -->
    <div v-else-if="config" class="space-y-6">
      <!-- Database settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          Database Settings
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Host</label>
            <input
              v-model="config.database.host"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Port</label>
            <input
              v-model.number="config.database.port"
              type="number"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Username</label>
            <input
              v-model="config.database.user"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Password</label>
            <input
              v-model="config.database.password"
              type="password"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Database Name</label>
            <input
              v-model="config.database.database"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
        </div>
      </div>

      <!-- Message settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          Message Settings
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Batch Size</label>
            <input
              v-model.number="config.message.export.batchSize"
              type="number"
              :min="1"
              :max="1000"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              @input="(e: Event) => handleNumberInput(e, ['message', 'export', 'batchSize'])"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Concurrent Requests</label>
            <input
              v-model.number="config.message.export.concurrent"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              @input="(e: Event) => handleNumberInput(e, ['message', 'export', 'concurrent'])"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Retry Times</label>
            <input
              v-model.number="config.message.export.retryTimes"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              @input="(e: Event) => handleNumberInput(e, ['message', 'export', 'retryTimes'])"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Max Takeout Retries</label>
            <input
              v-model.number="config.message.export.maxTakeoutRetries"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              @input="(e: Event) => handleNumberInput(e, ['message', 'export', 'maxTakeoutRetries'])"
            >
          </div>
        </div>
      </div>

      <!-- Path settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          Path Settings
        </h2>
        <div class="grid gap-4">
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Session Path</label>
            <input
              v-model="config.path.session"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Media Path</label>
            <input
              v-model="config.path.media"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
        </div>
      </div>

      <!-- API settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          API Settings
        </h2>
        <div class="space-y-4">
          <!-- Telegram API -->
          <div>
            <h3 class="mb-2 text-lg font-medium dark:text-white">
              Telegram API
            </h3>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">API ID</label>
                <input
                  v-model="config.api.telegram.apiId"
                  type="text"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">API Hash</label>
                <input
                  v-model="config.api.telegram.apiHash"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Phone Number</label>
                <input
                  v-model="config.api.telegram.phoneNumber"
                  type="tel"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
            </div>
          </div>

          <!-- OpenAI API -->
          <div>
            <h3 class="mb-2 text-lg font-medium dark:text-white">
              Embedding
            </h3>
            <div class="grid gap-4">
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Provider</label>
                <SelectDropdown v-model="config.api.embedding.provider" :options="embeddingProviderOptions" :disabled="!isEditing" />
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Model</label>
                <input
                  v-model="config.api.embedding.model"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">API Key</label>
                <input
                  v-model="config.api.embedding.apiKey"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">API Base URL</label>
                <input
                  v-model="config.api.embedding.apiBase"
                  type="text"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
