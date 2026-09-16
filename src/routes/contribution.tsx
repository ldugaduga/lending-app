import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { listClients } from '@/server/clients'
import { listTrustFundContributions, recordTrustFundContribution } from '@/server/trustFund'
import { getTotalEarnings } from '@/server/loans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, computeTrustFundBalances } from '@/lib/utils'

export const Route = createFileRoute('/contribution')({
  component: ContributionPage,
  loader: async () => {
    const [clients, contributions, totalEarnings] = await Promise.all([
      listClients(),
      listTrustFundContributions(),
      getTotalEarnings(),
    ])
    return { clients, contributions, totalEarnings }
  },
})

function ContributionPage() {
  const { clients, contributions: initialContributions, totalEarnings: initialTotalEarnings } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const [isAddingContribution, setIsAddingContribution] = useState(false)

  const { data: contributions } = useQuery({
    queryKey: ['trustFundContributions'],
    queryFn: () => listTrustFundContributions(),
    initialData: initialContributions,
  })

  const { data: totalEarnings } = useQuery({
    queryKey: ['totalEarnings'],
    queryFn: () => getTotalEarnings(),
    initialData: initialTotalEarnings,
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Funds</h1>
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

      <p className="mb-4 text-lg font-semibold">Total earnings: {formatCurrency(totalEarnings)}</p>

      {contributions.length > 0 && (
        <>
          <p className="mb-4 text-lg font-semibold">
            Total trust fund holdings: {formatCurrency(computeTrustFundBalances(contributions).reduce((sum, b) => sum + b.total, 0))}
          </p>
          <h3 className="mb-3 text-lg font-semibold">Balances by Client</h3>
          <Table className="mb-6">
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computeTrustFundBalances(contributions).map((balance) => (
                <TableRow key={balance.id}>
                  <TableCell>{balance.name}</TableCell>
                  <TableCell>{formatCurrency(balance.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

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

      <h3 className="mb-3 text-lg font-semibold">Trust Fund Contributions</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Method / Loan</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contributions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No trust fund contributions yet.
              </TableCell>
            </TableRow>
          ) : (
            contributions.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.client.name}</TableCell>
                <TableCell>{formatCurrency(c.amount)}</TableCell>
                <TableCell>{c.type === 'drawdown' ? 'Drawdown' : 'Deposit'}</TableCell>
                <TableCell>
                  {c.loanId ? (
                    <Button asChild variant="link" size="sm">
                      <Link to="/loans/$loanId" params={{ loanId: String(c.loanId) }}>
                        View loan
                      </Link>
                    </Button>
                  ) : (
                    c.method
                  )}
                </TableCell>
                <TableCell>{new Date(c.contributedAt).toISOString().slice(0, 10)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
