import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { listOutstandingInstallments } from '@/server/collections'
import { listClients } from '@/server/clients'
import { listTrustFundContributions, recordTrustFundContribution } from '@/server/trustFund'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { cn, formatCurrency } from '@/lib/utils'

export const Route = createFileRoute('/collections')({
  component: CollectionsPage,
  loader: async () => {
    const [installments, clients, contributions] = await Promise.all([
      listOutstandingInstallments(),
      listClients(),
      listTrustFundContributions(),
    ])
    return { installments, clients, contributions }
  },
})

const BUCKET_LABELS: Record<string, string> = {
  overdue: 'Overdue',
  today: 'Due Today',
  this_week: 'Due This Week',
  upcoming: 'Upcoming',
}

function CollectionsPage() {
  const { installments: initialInstallments, clients, contributions: initialContributions } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const [isAddingContribution, setIsAddingContribution] = useState(false)

  const { data: items } = useQuery({
    queryKey: ['collections'],
    queryFn: () => listOutstandingInstallments(),
    initialData: initialInstallments,
  })

  const { data: contributions } = useQuery({
    queryKey: ['trustFundContributions'],
    queryFn: () => listTrustFundContributions(),
    initialData: initialContributions,
  })

  const activeClients = clients.filter((c) => c.status === 'active')

  const recordMutation = useMutation({
    mutationFn: recordTrustFundContribution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trustFundContributions'] })
      setIsAddingContribution(false)
      form.reset()
    },
  })

  const form = useForm({
    defaultValues: {
      clientId: activeClients[0]?.id ?? 0,
      amount: 0,
      method: 'cash' as 'cash' | 'bank_transfer' | 'card' | 'other',
    },
    onSubmit: async ({ value }) => {
      await recordMutation.mutateAsync({ data: value })
    },
  })

  const grouped = ['overdue', 'today', 'this_week', 'upcoming'].map((bucket) => ({
    bucket,
    rows: (items ?? []).filter((i) => i.bucket === bucket),
  }))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Collections</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={activeClients.length === 0}
            onClick={() => {
              setIsAddingContribution((v) => !v)
              form.reset()
            }}
          >
            {isAddingContribution ? 'Cancel' : 'Add Trust Fund Contribution'}
          </Button>
          {activeClients.length === 0 && (
            <span className="text-sm text-muted-foreground">Add an active client first</span>
          )}
        </div>
      </div>

      {isAddingContribution && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add trust fund contribution</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
              }}
              className="flex flex-wrap items-end gap-4"
            >
              <form.Field name="clientId">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contribution-client">Client</Label>
                    <Select
                      value={String(field.state.value)}
                      onValueChange={(v) => field.handleChange(Number(v))}
                    >
                      <SelectTrigger id="contribution-client">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeClients.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
              <form.Field name="amount">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contribution-amount">Amount</Label>
                    <Input
                      id="contribution-amount"
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="method">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contribution-method">Method</Label>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as any)}>
                      <SelectTrigger id="contribution-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
              <Button type="submit" disabled={recordMutation.isPending}>
                {recordMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </form>
            {recordMutation.isError && (
              <p className="mt-4 text-sm text-destructive">{recordMutation.error.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {grouped.map(({ bucket, rows }) => (
          <Card key={bucket} className={cn(rows.length > 0 && 'col-span-full')}>
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
                        <TableCell>{formatCurrency(row.totalDue - row.amountPaid)}</TableCell>
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

      <h3 className="mt-6 mb-3 text-lg font-semibold">Trust Fund Contributions</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contributions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No trust fund contributions yet.
              </TableCell>
            </TableRow>
          ) : (
            contributions.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.client.name}</TableCell>
                <TableCell>{formatCurrency(c.amount)}</TableCell>
                <TableCell>{c.method}</TableCell>
                <TableCell>{new Date(c.contributedAt).toISOString().slice(0, 10)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
