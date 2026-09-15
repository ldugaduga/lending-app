import { createRootRouteWithContext, Outlet, Link, HeadContent, Scripts } from '@tanstack/react-router'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import appCss from '../styles/app.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Lending App</title>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <div className="flex min-h-screen flex-col sm:flex-row">
            <nav className="flex gap-6 border-b border-border bg-[#f8f8f8] px-6 py-4 sm:w-56 sm:shrink-0 sm:flex-col sm:gap-2 sm:border-b-0 sm:border-r sm:px-4 sm:py-6">
              <Link
                to="/clients"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-semibold"
              >
                Clients
              </Link>
              <Link
                to="/loans"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-semibold"
              >
                Loans
              </Link>
              <Link
                to="/collections"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-semibold"
              >
                Collections
              </Link>
            </nav>
            <main className="flex-1 p-6">
              <Outlet />
            </main>
          </div>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
