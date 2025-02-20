<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import DefaultLayout from './layouts/default.vue'
</script>

<template>
  <div class="min-h-screen bg-white transition-colors duration-300 dark:bg-gray-900">
    <Toaster position="top-right" :expand="true" :rich-colors="true" />
    <DefaultLayout>
      <router-view />
    </DefaultLayout>
  </div>
</template>

<style>
:root {
  --dark-transition-duration: 0.3s;
}

::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

/* Add global color transition animations */
*,
::before,
::after {
  transition:
    border-color var(--dark-transition-duration) ease-in-out,
    background-color var(--dark-transition-duration) ease-in-out,
    color var(--dark-transition-duration) ease-in-out,
    fill var(--dark-transition-duration) ease-in-out,
    stroke var(--dark-transition-duration) ease-in-out;
}
</style>
