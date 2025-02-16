import type { AppRouter } from './router'

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'

// Create tRPC client
export function createClient(baseUrl: string) {
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson as any,
    links: [
      httpBatchLink({
        url: `${baseUrl}/trpc`,
        fetch: (input: URL | RequestInfo, options?: RequestInit) => {
          return fetch(input, {
            ...options,
            credentials: 'include',
            headers: {
              ...options?.headers,
              'Content-Type': 'application/json',
            },
          })
        },
      }),
    ],
  })
}
