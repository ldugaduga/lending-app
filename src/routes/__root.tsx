import { createRootRouteWithContext, Outlet, Link, HeadContent, Scripts } from '@tanstack/react-router'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { Users, HandCoins, Receipt, PiggyBank } from 'lucide-react'
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
                className="inline-flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-semibold"
              >
                <Users className="size-4" />
                <span>Clients</span>
              </Link>
              <Link
                to="/loans"
                className="inline-flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-semibold"
              >
                <HandCoins className="size-4" />
                <span>Loans</span>
              </Link>
              <Link
                to="/collections"
                className="inline-flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-semibold"
              >
                <Receipt className="size-4" />
                <span>Collections</span>
              </Link>
              <Link
                to="/contribution"
                className="inline-flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-semibold"
              >
                <PiggyBank className="size-4" />
                <span>Funds</span>
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
