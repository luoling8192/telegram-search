<template>
  <div class="flex flex-col items-center justify-center min-h-screen">
    <div class="animate-bounce">
      <div class="text-8xl text-gray-800">
        <i class="fas fa-exclamation-circle"></i>
      </div>
      <h1 class="text-6xl font-bold text-gray-800">404</h1>
    </div>
    <p class="mt-4 text-xl text-gray-600 animate-fade-in">Page Not Found</p>
    <router-link 
      to="/" 
      class="mt-8 flex items-center gap-2 text-blue-500 hover:text-blue-600 transition-colors duration-200"
    >
      <i class="fas fa-home"></i>
      <span>Return to Home</span>
    </router-link>
  </div>
</template>
