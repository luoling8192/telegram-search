import { createServer } from 'node:http'
import { chatRouter } from './routers/chat'
import { router } from './trpc'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

// Create the root router
export const appRouter = router({
  chat: chatRouter,
})

// Export type definition of API
export type AppRouter = typeof appRouter

// Create HTTP server
const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3333')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Handle tRPC requests
  if (req.url?.startsWith('/trpc')) {
    const response = await fetchRequestHandler({
      endpoint: '/trpc',
      req: new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
      }),
      router: appRouter,
      createContext: () => ({}),
    })

    res.setHeader('Content-Type', response.headers.get('Content-Type') ?? 'application/json')
    res.writeHead(response.status)
    res.end(await response.text())
    return
  }

  // Handle 404
  res.writeHead(404)
  res.end('Not found')
})

// Start server
server.listen(3000)
console.log('Server listening on http://localhost:3000')
