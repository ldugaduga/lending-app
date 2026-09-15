import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { getLoan } from '@/server/loans'
import { recordPayment } from '@/server/payments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export const Route = createFileRoute('/loans/$loanId')({
  component: LoanDetailPage,
  loader: async ({ params }) => getLoan({ data: { id: Number(params.loanId) } }),
})

function LoanDetailPage() {
  const initialLoan = Route.useLoaderData()
  const { loanId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data: loan } = useQuery({
    queryKey: ['loan', loanId],
    queryFn: () => getLoan({ data: { id: Number(loanId) } }),
    initialData: initialLoan,
  })

  const paymentMutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
    },
  })

  const form = useForm({
    defaultValues: { amount: 0, method: 'cash' as 'cash' | 'bank_transfer' | 'card' | 'other' },
    onSubmit: async ({ value }) => {
      await paymentMutation.mutateAsync({ data: { loanId: Number(loanId), ...value } })
      form.reset()
    },
  })

  if (!loan) return <p>Loan not found.</p>

  const totalOwed = loan.installments.reduce((sum, i) => sum + (i.totalDue - i.amountPaid), 0)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">
        Loan #{loan.id} — {loan.client.name}
      </h1>
      <p className="mb-1 text-sm text-muted-foreground">
        Principal ${loan.principal.toFixed(2)} · Rate {loan.interestRate}% ({loan.interestType}) ·{' '}
        {loan.termMonths} months · {loan.repaymentFrequency} · Status: {loan.status}
      </p>
      <p className="mb-6 text-lg font-semibold">Remaining balance owed: ${totalOwed.toFixed(2)}</p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Record a payment</CardTitle>
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
            <form.Field name="amount">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payment-amount">Amount</Label>
                  <Input
                    id="payment-amount"
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
                  <Label htmlFor="payment-method">Method</Label>
                  <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as any)}>
                    <SelectTrigger id="payment-method">
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
            <Button type="submit" disabled={loan.status === 'paid_off' || paymentMutation.isPending}>
              {paymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
            {loan.status === 'paid_off' && (
              <span className="text-sm text-muted-foreground">Loan is fully paid off</span>
            )}
          </form>
          {paymentMutation.isError && (
            <p className="mt-4 text-sm text-destructive">{paymentMutation.error.message}</p>
          )}
        </CardContent>
      </Card>

      <h3 className="mb-3 text-lg font-semibold">Amortization schedule</h3>
      <Table className="mb-6">
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Principal</TableHead>
            <TableHead>Interest</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loan.installments.map((inst) => (
            <TableRow key={inst.id}>
              <TableCell>{inst.installmentNumber}</TableCell>
              <TableCell>{new Date(inst.dueDate).toISOString().slice(0, 10)}</TableCell>
              <TableCell>${inst.principalPortion.toFixed(2)}</TableCell>
              <TableCell>${inst.interestPortion.toFixed(2)}</TableCell>
              <TableCell>${inst.totalDue.toFixed(2)}</TableCell>
              <TableCell>${inst.amountPaid.toFixed(2)}</TableCell>
              <TableCell>{inst.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <h3 className="mb-3 text-lg font-semibold">Payment history</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loan.payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No payments recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            loan.payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>${p.amount.toFixed(2)}</TableCell>
                <TableCell>{p.method}</TableCell>
                <TableCell>{new Date(p.paidAt).toISOString().slice(0, 10)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
