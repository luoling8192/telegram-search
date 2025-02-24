import { ref } from 'vue'

export function useReconnect() {
  const maxAttempts = 3
  const baseDelay = 5000
  const attempts = ref(0)

  // 指数退避策略
  const calculateDelay = () =>
    Math.min(baseDelay * 2 ** attempts.value, 30000)

  const resetAttempts = () => attempts.value = 0
  const recordAttempt = () => attempts.value++

  return {
    maxAttempts,
    calculateDelay,
    resetAttempts,
    recordAttempt,
    attempts,
  }
}
