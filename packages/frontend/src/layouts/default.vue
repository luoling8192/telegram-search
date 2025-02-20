<script setup lang="ts">
import { isDark, toggleDark } from '../composables/dark'
</script>

<template>
  <div class="min-h-screen" :class="{ dark: isDark }">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b bg-white dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto h-14 flex items-center justify-between px-4 container">
        <router-link to="/" class="text-lg font-semibold dark:text-white">
          Telegram Search
        </router-link>

        <div class="flex items-center gap-4">
          <button
            class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            @click="toggleDark()"
          >
            <div class="i-carbon-moon dark:i-carbon-sun h-5 w-5 dark:text-white" />
          </button>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto bg-white container dark:bg-gray-900">
      <slot />
    </main>
  </div>
</template>
