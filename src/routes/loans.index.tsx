import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import { CalendarIcon } from 'lucide-react'
import { listLoans, createLoan, previewLoan, deleteLoan } from '@/server/loans'
import { listClients } from '@/server/clients'
import { listTrustFundContributions } from '@/server/trustFund'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, todayInManila, toDateInputValue, computeTrustFundBalances } from '@/lib/utils'

export const Route = createFileRoute('/loans/')({
  component: LoansPage,
  loader: async () => {
    const [loans, clients, contributions] = await Promise.all([
      listLoans(),
      listClients(),
      listTrustFundContributions(),
    ])
    return { loans, clients, contributions }
  },
})

type Loan = Awaited<ReturnType<typeof listLoans>>[number]
const columnHelper = createColumnHelper<Loan>()

function LoansPage() {
  const { loans: initialLoans, clients, contributions: initialContributions } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewLoan>> | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewPending, setIsPreviewPending] = useState(false)

  const { data: loans } = useQuery({
    queryKey: ['loans'],
    queryFn: () => listLoans(),
    initialData: initialLoans,
  })

  const { data: contributions } = useQuery({
    queryKey: ['trustFundContributions'],
    queryFn: () => listTrustFundContributions(),
    initialData: initialContributions,
  })

  const activeClients = clients.filter((c) => c.status === 'active')
  const trustFundBalances = computeTrustFundBalances(contributions)

  const createMutation = useMutation({
    mutationFn: createLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      setPreview(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans'] }),
  })

  const form = useForm({
    defaultValues: {
      clientId: activeClients[0]?.id ?? 0,
      principal: 1000,
      interestRate: 18,
      interestType: 'declining' as 'fixed' | 'declining',
      termMonths: 6,
      repaymentFrequency: 'monthly' as 'daily' | 'weekly' | 'biweekly' | 'monthly',
      startDate: todayInManila(),
      fundDrawdown: 0,
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({ data: value })
      form.reset()
    },
  })

  async function handlePreview() {
    if (preview) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    const values = form.state.values
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
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button asChild variant="link" size="sm">
            <Link to="/loans/$loanId" params={{ loanId: String(row.original.id) }}>
              View
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm(`Delete loan #${row.original.id}? This cannot be undone.`)) {
                deleteMutation.mutate({ data: { id: row.original.id } })
              }
            }}
          >
            Delete
          </Button>
        </div>
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
              <span className="text-sm text-muted-foreground">
                Trust fund balance:{' '}
                {formatCurrency(trustFundBalances.find((b) => b.id === field.state.value)?.current ?? 0)}
              </span>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="loan-start-date" type="button" variant="outline" className="justify-start font-normal">
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
        </form.Field>
        <form.Subscribe selector={(state) => state.values.clientId}>
          {(clientId) => {
            const balance = trustFundBalances.find((b) => b.id === clientId)?.current ?? 0
            return (
              <form.Field name="fundDrawdown">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="loan-fund-drawdown">Fund from trust fund</Label>
                    <Input
                      id="loan-fund-drawdown"
                      type="number"
                      step="0.01"
                      max={balance}
                      placeholder="0"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                    />
                    <span className="text-sm text-muted-foreground">
                      Up to {formatCurrency(balance)} available
                    </span>
                  </div>
                )}
              </form.Field>
            )
          }}
        </form.Subscribe>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <Button type="button" variant="outline" onClick={handlePreview} disabled={isPreviewPending}>
            {isPreviewPending ? 'Previewing...' : preview ? 'Hide Preview' : 'Preview'}
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
      {deleteMutation.isError && (
        <p className="mb-4 text-sm text-destructive">{deleteMutation.error.message}</p>
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
