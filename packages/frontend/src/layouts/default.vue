<script setup lang="ts">
import { useRouter } from 'vue-router'
import { isDark } from '../composables/dark'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen" :class="{ dark: isDark }">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b bg-white transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto h-14 flex items-center justify-between px-4 container">
        <router-link to="/" class="text-lg font-semibold transition-colors duration-300 dark:text-white">
          Telegram Search
        </router-link>

        <div class="flex items-center gap-4">
          <ThemeToggle />

          <button
            class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            @click="router.push('/commands')"
          >
            <div class="i-carbon-mac-command h-5 w-5 dark:text-white" />
          </button>

          <button
            class="rounded-lg p-2 transition-colors duration-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            @click="router.push('/settings')"
          >
            <div class="i-carbon-settings h-5 w-5 transition-colors duration-300 dark:text-white" />
          </button>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto bg-white transition-colors duration-300 container dark:bg-gray-900">
      <slot />
    </main>
  </div>
</template>
