import { createRootRouteWithContext, Outlet, Link } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Lending App</title>
      </head>
      <body>
        <nav style={{ display: 'flex', gap: '1rem', padding: '1rem', borderBottom: '1px solid #ddd' }}>
          <Link to="/clients">Clients</Link>
          <Link to="/loans">Loans</Link>
          <Link to="/collections">Collections</Link>
        </nav>
        <main style={{ padding: '1.5rem' }}>
          <Outlet />
        </main>
      </body>
    </html>
  )
}
