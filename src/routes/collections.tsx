import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listOutstandingInstallments } from '@/server/collections'

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
      <h1>Collections</h1>
      {grouped.map(({ bucket, rows }) => (
        <div key={bucket} style={{ marginBottom: '1.5rem' }}>
          <h3>{BUCKET_LABELS[bucket]} ({rows.length})</h3>
          {rows.length === 0 ? (
            <p style={{ color: '#888' }}>Nothing here.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Client</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Phone</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Due date</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Amount owed</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{row.clientName}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{row.clientPhone}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                      {new Date(row.dueDate).toISOString().slice(0, 10)}
                    </td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                      ${(row.totalDue - row.amountPaid).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                      <Link to="/loans/$loanId" params={{ loanId: String(row.loanId) }}>View loan</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}
