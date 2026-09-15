import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import { listLoans, createLoan, previewLoan } from '@/server/loans'
import { listClients } from '@/server/clients'

export const Route = createFileRoute('/loans')({
  component: LoansPage,
  loader: async () => {
    const [loans, clients] = await Promise.all([listLoans(), listClients()])
    return { loans, clients }
  },
})

type Loan = Awaited<ReturnType<typeof listLoans>>[number]
const columnHelper = createColumnHelper<Loan>()

function LoansPage() {
  const { loans: initialLoans, clients } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewLoan>> | null>(null)

  const { data: loans } = useQuery({
    queryKey: ['loans'],
    queryFn: () => listLoans(),
    initialData: initialLoans,
  })

  const activeClients = clients.filter((c) => c.status === 'active')

  const createMutation = useMutation({
    mutationFn: createLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      setPreview(null)
    },
  })

  const form = useForm({
    defaultValues: {
      clientId: activeClients[0]?.id ?? 0,
      principal: 1000,
      interestRate: 18,
      interestType: 'declining' as 'fixed' | 'declining',
      termMonths: 6,
      repaymentFrequency: 'monthly' as 'daily' | 'weekly' | 'biweekly' | 'monthly',
      startDate: new Date().toISOString().slice(0, 10),
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({ data: value })
      form.reset()
    },
  })

  async function handlePreview() {
    const values = form.state.values
    try {
      const result = await previewLoan({ data: values })
      setPreview(result)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not generate preview')
    }
  }

  const columns = [
    columnHelper.accessor((row) => row.client?.name, { id: 'client', header: 'Client' }),
    columnHelper.accessor('principal', { header: 'Principal', cell: (c) => `$${c.getValue().toFixed(2)}` }),
    columnHelper.accessor('interestRate', { header: 'Rate', cell: (c) => `${c.getValue()}%` }),
    columnHelper.accessor('interestType', { header: 'Type' }),
    columnHelper.accessor('termMonths', { header: 'Term (mo)' }),
    columnHelper.accessor('status', { header: 'Status' }),
    columnHelper.display({
      id: 'view',
      header: '',
      cell: ({ row }) => <Link to="/loans/$loanId" params={{ loanId: String(row.original.id) }}>View</Link>,
    }),
  ]

  const table = useReactTable({
    data: loans ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <h1>Loans</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}
      >
        <form.Field name="clientId">
          {(field) => (
            <select value={field.state.value} onChange={(e) => field.handleChange(Number(e.target.value))}>
              {activeClients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </form.Field>
        <form.Field name="principal">
          {(field) => (
            <input type="number" placeholder="Principal" value={field.state.value}
              onChange={(e) => field.handleChange(Number(e.target.value))} />
          )}
        </form.Field>
        <form.Field name="interestRate">
          {(field) => (
            <input type="number" placeholder="Rate % (total term)" value={field.state.value}
              onChange={(e) => field.handleChange(Number(e.target.value))} />
          )}
        </form.Field>
        <form.Field name="interestType">
          {(field) => (
            <select value={field.state.value} onChange={(e) => field.handleChange(e.target.value as any)}>
              <option value="fixed">Fixed</option>
              <option value="declining">Declining balance</option>
            </select>
          )}
        </form.Field>
        <form.Field name="termMonths">
          {(field) => (
            <input type="number" placeholder="Term (months)" value={field.state.value}
              onChange={(e) => field.handleChange(Number(e.target.value))} />
          )}
        </form.Field>
        <form.Field name="repaymentFrequency">
          {(field) => (
            <select value={field.state.value} onChange={(e) => field.handleChange(e.target.value as any)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          )}
        </form.Field>
        <form.Field name="startDate">
          {(field) => (
            <input type="date" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
          )}
        </form.Field>
        <button type="button" onClick={handlePreview}>Preview</button>
        <button type="submit" disabled={activeClients.length === 0}>Create Loan</button>
        {activeClients.length === 0 && <span>Add an active client first</span>}
      </form>

      {preview && (
        <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3>Preview</h3>
          <p>
            Total interest: ${preview.summary.totalInterest.toFixed(2)} · Total repayment: $
            {preview.summary.totalRepayment.toFixed(2)} · APR: {preview.summary.apr}% · Installments:{' '}
            {preview.summary.installmentCount}
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>#</th>
                <th style={{ textAlign: 'left' }}>Due</th>
                <th style={{ textAlign: 'left' }}>Principal</th>
                <th style={{ textAlign: 'left' }}>Interest</th>
                <th style={{ textAlign: 'left' }}>Total</th>
                <th style={{ textAlign: 'left' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {preview.schedule.slice(0, 6).map((row) => (
                <tr key={row.installmentNumber}>
                  <td>{row.installmentNumber}</td>
                  <td>{row.dueDate}</td>
                  <td>${row.principalPortion.toFixed(2)}</td>
                  <td>${row.interestPortion.toFixed(2)}</td>
                  <td>${row.totalDue.toFixed(2)}</td>
                  <td>${row.balanceRemaining.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.schedule.length > 6 && <p>...and {preview.schedule.length - 6} more installments</p>}
        </div>
      )}

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th key={header.id} style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
