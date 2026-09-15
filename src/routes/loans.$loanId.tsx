import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { getLoan } from '@/server/loans'
import { recordPayment } from '@/server/payments'

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
      <h1>Loan #{loan.id} — {loan.client.name}</h1>
      <p>
        Principal ${loan.principal.toFixed(2)} · Rate {loan.interestRate}% ({loan.interestType}) ·{' '}
        {loan.termMonths} months · {loan.repaymentFrequency} · Status: {loan.status}
      </p>
      <p><strong>Remaining balance owed: ${totalOwed.toFixed(2)}</strong></p>

      <h3>Record a payment</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}
      >
        <form.Field name="amount">
          {(field) => (
            <input type="number" step="0.01" placeholder="Amount" value={field.state.value}
              onChange={(e) => field.handleChange(Number(e.target.value))} />
          )}
        </form.Field>
        <form.Field name="method">
          {(field) => (
            <select value={field.state.value} onChange={(e) => field.handleChange(e.target.value as any)}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          )}
        </form.Field>
        <button type="submit" disabled={loan.status === 'paid_off'}>Record Payment</button>
        {loan.status === 'paid_off' && <span>Loan is fully paid off</span>}
      </form>

      <h3>Amortization schedule</h3>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '1.5rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>#</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Due</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Principal</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Interest</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Total</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Paid</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {loan.installments.map((inst) => (
            <tr key={inst.id}>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{inst.installmentNumber}</td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                {new Date(inst.dueDate).toISOString().slice(0, 10)}
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>${inst.principalPortion.toFixed(2)}</td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>${inst.interestPortion.toFixed(2)}</td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>${inst.totalDue.toFixed(2)}</td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>${inst.amountPaid.toFixed(2)}</td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{inst.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Payment history</h3>
      <ul>
        {loan.payments.map((p) => (
          <li key={p.id}>
            ${p.amount.toFixed(2)} via {p.method} on {new Date(p.paidAt).toISOString().slice(0, 10)}
          </li>
        ))}
        {loan.payments.length === 0 && <li>No payments recorded yet.</li>}
      </ul>
    </div>
  )
}
