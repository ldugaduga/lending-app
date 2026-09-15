import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { CalendarIcon } from 'lucide-react'
import { getLoan, deleteLoan, updateLoan } from '@/server/loans'
import { recordPayment } from '@/server/payments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, toDateInputValue } from '@/lib/utils'

export const Route = createFileRoute('/loans/$loanId')({
  component: LoanDetailPage,
  loader: async ({ params }) => getLoan({ data: { id: Number(params.loanId) } }),
})

function LoanDetailPage() {
  const initialLoan = Route.useLoaderData()
  const { loanId } = Route.useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)

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

  const deleteMutation = useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      navigate({ to: '/loans' })
    },
  })

  const form = useForm({
    defaultValues: { amount: 0, method: 'cash' as 'cash' | 'bank_transfer' | 'card' | 'other' },
    onSubmit: async ({ value }) => {
      await paymentMutation.mutateAsync({ data: { loanId: Number(loanId), ...value } })
      form.reset()
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      setIsEditing(false)
    },
  })

  const editForm = useForm({
    defaultValues: {
      principal: loan?.principal ?? 0,
      interestRate: loan?.interestRate ?? 0,
      interestType: (loan?.interestType ?? 'declining') as 'fixed' | 'declining',
      termMonths: loan?.termMonths ?? 1,
      repaymentFrequency: (loan?.repaymentFrequency ?? 'monthly') as
        | 'daily'
        | 'weekly'
        | 'biweekly'
        | 'monthly',
      startDate: loan?.startDate ? new Date(loan.startDate).toISOString().slice(0, 10) : '',
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({ data: { id: Number(loanId), ...value } })
    },
  })

  if (!loan) return <p>Loan not found.</p>

  const totalOwed = loan.installments.reduce((sum, i) => sum + (i.totalDue - i.amountPaid), 0)
  const canEdit = loan.payments.length === 0

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          Loan #{loan.id} — {loan.client.name}
        </h1>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing((v) => !v)
                editForm.reset()
              }}
            >
              {isEditing ? 'Cancel Edit' : 'Edit Loan'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm(`Delete loan #${loan.id}? This cannot be undone.`)) {
                deleteMutation.mutate({ data: { id: loan.id } })
              }
            }}
          >
            Delete Loan
          </Button>
        </div>
      </div>
      <p className="mb-1 text-sm text-muted-foreground">
        Principal {formatCurrency(loan.principal)} · Rate {loan.interestRate}% ({loan.interestType}) ·{' '}
        {loan.termMonths} months · {loan.repaymentFrequency} · Status: {loan.status}
      </p>
      <p className="mb-6 text-lg font-semibold">Remaining balance owed: {formatCurrency(totalOwed)}</p>
      {deleteMutation.isError && (
        <p className="mb-6 text-sm text-destructive">{deleteMutation.error.message}</p>
      )}

      {isEditing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Edit loan terms</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                editForm.handleSubmit()
              }}
              className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
            >
              <editForm.Field name="principal">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-loan-principal">Principal</Label>
                    <Input
                      id="edit-loan-principal"
                      type="number"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                    />
                  </div>
                )}
              </editForm.Field>
              <editForm.Field name="interestRate">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-loan-rate">Rate % (total term)</Label>
                    <Input
                      id="edit-loan-rate"
                      type="number"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                    />
                  </div>
                )}
              </editForm.Field>
              <editForm.Field name="interestType">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-loan-interest-type">Interest type</Label>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as any)}>
                      <SelectTrigger id="edit-loan-interest-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="declining">Declining balance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </editForm.Field>
              <editForm.Field name="termMonths">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-loan-term">Term (months)</Label>
                    <Input
                      id="edit-loan-term"
                      type="number"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                    />
                  </div>
                )}
              </editForm.Field>
              <editForm.Field name="repaymentFrequency">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-loan-frequency">Frequency</Label>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as any)}>
                      <SelectTrigger id="edit-loan-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </editForm.Field>
              <editForm.Field name="startDate">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-loan-start-date">Start date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="edit-loan-start-date"
                          type="button"
                          variant="outline"
                          className="justify-start font-normal"
                        >
                          <CalendarIcon />
                          {field.state.value || 'Select a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.state.value ? new Date(field.state.value + 'T00:00:00') : undefined}
                          onSelect={(date) => date && field.handleChange(toDateInputValue(date))}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </editForm.Field>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    editForm.reset()
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
            {updateMutation.isError && (
              <p className="mt-4 text-sm text-destructive">{updateMutation.error.message}</p>
            )}
          </CardContent>
        </Card>
      )}

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
              <TableCell>{formatCurrency(inst.principalPortion)}</TableCell>
              <TableCell>{formatCurrency(inst.interestPortion)}</TableCell>
              <TableCell>{formatCurrency(inst.totalDue)}</TableCell>
              <TableCell>{formatCurrency(inst.amountPaid)}</TableCell>
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
                <TableCell>{formatCurrency(p.amount)}</TableCell>
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
