import { createRouter as createTanstackRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

export function createRouter() {
  const queryClient = new QueryClient()

  return createTanstackRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}

// The server request handler resolves the router through the '#tanstack-router-entry'
// virtual module, which requires a `getRouter` export (see @tanstack/start-client-core's
// RouterEntry interface) - `createRouter` alone isn't enough server-side. client.tsx still
// imports `createRouter` by name, so both exports stay.
export { createRouter as getRouter }
