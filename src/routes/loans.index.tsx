import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import { listLoans, createLoan, previewLoan } from '@/server/loans'
import { listClients } from '@/server/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

export const Route = createFileRoute('/loans/')({
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
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewPending, setIsPreviewPending] = useState(false)

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
    setPreview(null)
    setPreviewError(null)
    setIsPreviewPending(true)
    try {
      const result = await previewLoan({ data: values })
      setPreview(result)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not generate preview')
    } finally {
      setIsPreviewPending(false)
    }
  }

  const columns = [
    columnHelper.accessor((row) => row.client?.name, { id: 'client', header: 'Client' }),
    columnHelper.accessor('principal', { header: 'Principal', cell: (c) => formatCurrency(c.getValue()) }),
    columnHelper.accessor('interestRate', { header: 'Rate', cell: (c) => `${c.getValue()}%` }),
    columnHelper.accessor('interestType', { header: 'Type' }),
    columnHelper.accessor('termMonths', { header: 'Term (mo)' }),
    columnHelper.accessor('status', { header: 'Status' }),
    columnHelper.display({
      id: 'view',
      header: '',
      cell: ({ row }) => (
        <Button asChild variant="link" size="sm">
          <Link to="/loans/$loanId" params={{ loanId: String(row.original.id) }}>
            View
          </Link>
        </Button>
      ),
    }),
  ]

  const table = useReactTable({
    data: loans ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Loans</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="mb-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
      >
        <form.Field name="clientId">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loan-client">Client</Label>
              <Select
                value={String(field.state.value)}
                onValueChange={(v) => field.handleChange(Number(v))}
              >
                <SelectTrigger id="loan-client">
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
        <form.Field name="principal">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loan-principal">Principal</Label>
              <Input
                id="loan-principal"
                type="number"
                placeholder="Principal"
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="interestRate">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loan-rate">Rate % (total term)</Label>
              <Input
                id="loan-rate"
                type="number"
                placeholder="Rate % (total term)"
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="interestType">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loan-interest-type">Interest type</Label>
              <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as any)}>
                <SelectTrigger id="loan-interest-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="declining">Declining balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="termMonths">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loan-term">Term (months)</Label>
              <Input
                id="loan-term"
                type="number"
                placeholder="Term (months)"
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="repaymentFrequency">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loan-frequency">Frequency</Label>
              <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as any)}>
                <SelectTrigger id="loan-frequency">
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
        </form.Field>
        <form.Field name="startDate">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loan-start-date">Start date</Label>
              <Input
                id="loan-start-date"
                type="date"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <Button type="button" variant="outline" onClick={handlePreview} disabled={isPreviewPending}>
            {isPreviewPending ? 'Previewing...' : 'Preview'}
          </Button>
          <Button type="submit" disabled={activeClients.length === 0}>
            Create Loan
          </Button>
          {activeClients.length === 0 && (
            <span className="text-sm text-muted-foreground">Add an active client first</span>
          )}
        </div>
      </form>

      {previewError && <p className="mb-4 text-sm text-destructive">{previewError}</p>}
      {createMutation.isError && (
        <p className="mb-4 text-sm text-destructive">{createMutation.error.message}</p>
      )}

      {preview && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Total interest: {formatCurrency(preview.summary.totalInterest)} · Total repayment:{' '}
              {formatCurrency(preview.summary.totalRepayment)} · APR: {preview.summary.apr}% · Installments:{' '}
              {preview.summary.installmentCount}
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.schedule.slice(0, 6).map((row) => (
                  <TableRow key={row.installmentNumber}>
                    <TableCell>{row.installmentNumber}</TableCell>
                    <TableCell>{row.dueDate}</TableCell>
                    <TableCell>{formatCurrency(row.principalPortion)}</TableCell>
                    <TableCell>{formatCurrency(row.interestPortion)}</TableCell>
                    <TableCell>{formatCurrency(row.totalDue)}</TableCell>
                    <TableCell>{formatCurrency(row.balanceRemaining)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.schedule.length > 6 && (
              <p className="mt-2 text-sm text-muted-foreground">
                ...and {preview.schedule.length - 6} more installments
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                No loans yet.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
