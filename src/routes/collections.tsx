import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listOutstandingInstallments } from '@/server/collections'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/collections')({
  component: CollectionsPage,
  loader: async () => listOutstandingInstallments(),
})

const BUCKET_LABELS: Record<string, string> = {
  overdue: 'Overdue',
  today: 'Due Today',
  this_week: 'Due This Week',
  upcoming: 'Upcoming',
}

function CollectionsPage() {
  const initial = Route.useLoaderData()

  const { data: items } = useQuery({
    queryKey: ['collections'],
    queryFn: () => listOutstandingInstallments(),
    initialData: initial,
  })

  const grouped = ['overdue', 'today', 'this_week', 'upcoming'].map((bucket) => ({
    bucket,
    rows: (items ?? []).filter((i) => i.bucket === bucket),
  }))

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Collections</h1>
      <div className="flex flex-col gap-6">
        {grouped.map(({ bucket, rows }) => (
          <Card key={bucket}>
            <CardHeader>
              <CardTitle className={cn(bucket === 'overdue' && 'text-destructive')}>
                {BUCKET_LABELS[bucket]} ({rows.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing here.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Amount owed</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.clientName}</TableCell>
                        <TableCell>{row.clientPhone}</TableCell>
                        <TableCell>{new Date(row.dueDate).toISOString().slice(0, 10)}</TableCell>
                        <TableCell>${(row.totalDue - row.amountPaid).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button asChild variant="link" size="sm">
                            <Link to="/loans/$loanId" params={{ loanId: String(row.loanId) }}>
                              View loan
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
