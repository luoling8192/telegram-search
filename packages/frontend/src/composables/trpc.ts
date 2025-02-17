import { useQuery } from '@tanstack/vue-query'
import type { AppRouter } from '@tg-search/server'
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import { computed, unref, type MaybeRef } from 'vue'

// Create TRPC client
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
})

// Create composable for TRPC queries
export function useTRPCQuery<TInput, TOutput>(
  key: string[],
  queryFn: (input: TInput) => Promise<TOutput>,
  input: MaybeRef<TInput>,
) {
  const queryKey = computed(() => [...key, unref(input)])
  return useQuery({
    queryKey: queryKey.value,
    queryFn: () => queryFn(unref(input)),
  })
}
