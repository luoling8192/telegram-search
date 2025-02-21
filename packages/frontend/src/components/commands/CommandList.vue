<!-- Command list component -->
<script setup lang="ts">
import type { Command } from '@tg-search/server/types'

defineProps<{
  commands: Command[]
}>()
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="command in commands"
      :key="command.id"
      class="rounded bg-white p-4 shadow"
    >
      <div class="flex items-center justify-between">
        <div>
          <span class="font-semibold">{{ command.type }}</span>
          <span
            class="ml-2 rounded px-2 py-1 text-sm"
            :class="{
              'bg-yellow-100 text-yellow-800': command.status === 'running',
              'bg-green-100 text-green-800': command.status === 'success',
              'bg-red-100 text-red-800': command.status === 'error',
              'bg-gray-100 text-gray-800': command.status === 'idle',
            }"
          >
            {{ command.status }}
          </span>
        </div>
        <div class="text-sm text-gray-500">
          {{ new Date(command.createdAt).toLocaleString() }}
        </div>
      </div>

      <!-- Progress bar -->
      <div class="mt-2 h-2 rounded bg-gray-200">
        <div
          class="h-full rounded transition-all duration-300"
          :class="{
            'bg-blue-500': command.status === 'running',
            'bg-green-500': command.status === 'success',
            'bg-red-500': command.status === 'error',
            'bg-gray-500': command.status === 'idle',
          }"
          :style="{ width: `${command.progress}%` }"
        />
      </div>

      <!-- Message -->
      <div class="mt-2 text-sm text-gray-600">
        {{ command.message }}
      </div>
    </div>
  </div>
</template>
