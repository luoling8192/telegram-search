<script setup lang="ts">
interface Option<T> {
  label: string
  value: T
}

interface Props<T> {
  modelValue: T[]
  options: Option<T>[]
  disabled?: boolean
  label?: string
  columns?: number
}

const props = withDefaults(defineProps<Props<any>>(), {
  disabled: false,
  label: '',
  columns: 2,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: any[]): void
}>()

function handleChange(option: any, checked: boolean): void {
  const newValue = [...props.modelValue]

  if (checked) {
    if (!newValue.includes(option)) {
      newValue.push(option)
    }
  }
  else {
    const index = newValue.indexOf(option)
    if (index !== -1) {
      newValue.splice(index, 1)
    }
  }

  emit('update:modelValue', newValue)
}

function isChecked(value: any): boolean {
  return props.modelValue.includes(value)
}
</script>

<template>
  <div>
    <label v-if="label" class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
      {{ label }}
    </label>
    <div :class="`grid grid-cols-${columns} gap-3`">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-center border border-gray-200 rounded-md p-3 transition-colors dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/70"
        :class="{ 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20': isChecked(option.value) }"
      >
        <input
          type="checkbox"
          :checked="isChecked(option.value)"
          class="h-4 w-4 border-gray-300 rounded text-blue-600 transition-colors dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500"
          :disabled="disabled"
          @change="(e: Event) => handleChange(option.value, (e.target as HTMLInputElement).checked)"
        >
        <span class="ml-2.5 text-sm">{{ option.label }}</span>
      </label>
    </div>
  </div>
</template>
