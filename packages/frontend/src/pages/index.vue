<script setup lang="ts">
import type { MessageCreateInput as Message } from '@tg-search/db'
import { createColumnHelper, getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { trpc } from '../composables/trpc'
import { useTRPCQuery } from '../composables/trpc'

// Column definitions for the message table
const columnHelper = createColumnHelper<Message>()
const columns = [
  columnHelper.accessor('id', {
    header: 'ID',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('type', {
    header: 'Type',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('content', {
    header: 'Content',
    cell: info => info.getValue() || '-',
  }),
  columnHelper.accessor('fromId', {
    header: 'From',
    cell: info => info.getValue() || 'System',
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created At',
    cell: info => new Date(info.getValue()).toLocaleString(),
  }),
]

// Fetch messages data
const { data: messages } = useTRPCQuery(
  ['message', 'list'],
  (input: { chatId: number }) => trpc.message.list.query(input),
  { chatId: 1 },
)

// Initialize table
const table = useVueTable({
  get data() {
    return messages.value || []
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
})
</script>

<template>
  <div class="p-4">
    <h1 class="mb-4 text-2xl font-bold">
      Messages
    </h1>

    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th
            v-for="header in table.getHeaderGroups()[0].headers"
            :key="header.id"
            class="px-6 py-3 text-left text-xs text-gray-500 font-medium tracking-wider uppercase"
          >
            {{ header.column.columnDef.header }}
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr v-for="row in table.getRowModel().rows" :key="row.id">
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            class="whitespace-nowrap px-6 py-4 text-sm text-gray-500"
          >
            {{ cell.renderValue() }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
