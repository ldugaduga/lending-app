import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import { useState } from 'react'
import { listClients, createClient, updateClient, updateClientStatus, deleteClient } from '@/server/clients'
import { listTrustFundContributions } from '@/server/trustFund'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, computeTrustFundBalances } from '@/lib/utils'

export const Route = createFileRoute('/clients')({
  component: ClientsPage,
  loader: async () => {
    const [clients, contributions] = await Promise.all([listClients(), listTrustFundContributions()])
    return { clients, contributions }
  },
})

type Client = Awaited<ReturnType<typeof listClients>>[number]
const columnHelper = createColumnHelper<Client>()

function ClientsPage() {
  const { clients: initialClients, contributions: initialContributions } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const [editingClientId, setEditingClientId] = useState<number | null>(null)

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => listClients(),
    initialData: initialClients,
  })

  const { data: contributions } = useQuery({
    queryKey: ['trustFundContributions'],
    queryFn: () => listTrustFundContributions(),
    initialData: initialContributions,
  })

  const trustFundBalances = computeTrustFundBalances(contributions)

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })

  const statusMutation = useMutation({
    mutationFn: updateClientStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })

  const updateMutation = useMutation({
    mutationFn: updateClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })

  const form = useForm({
    defaultValues: { name: '', email: '', phone: '', address: '' },
    onSubmit: async ({ value }) => {
      if (editingClientId !== null) {
        await updateMutation.mutateAsync({ data: { id: editingClientId, ...value } })
        setEditingClientId(null)
      } else {
        await createMutation.mutateAsync({ data: value })
      }
      form.reset()
    },
  })

  function startEditing(client: Client) {
    setEditingClientId(client.id)
    form.setFieldValue('name', client.name)
    form.setFieldValue('email', client.email ?? '')
    form.setFieldValue('phone', client.phone ?? '')
    form.setFieldValue('address', client.address ?? '')
  }

  function cancelEditing() {
    setEditingClientId(null)
    form.reset()
  }

  const columns = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('phone', { header: 'Phone' }),
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.accessor('status', { header: 'Status' }),
    columnHelper.display({
      id: 'trustFundBalance',
      header: 'Trust Fund Balance',
      cell: ({ row }) => formatCurrency(trustFundBalances.find((b) => b.id === row.original.id)?.current ?? 0),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              statusMutation.mutate({
                data: {
                  id: row.original.id,
                  status: row.original.status === 'active' ? 'suspended' : 'active',
                },
              })
            }
          >
            {row.original.status === 'active' ? 'Suspend' : 'Activate'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => startEditing(row.original)}>
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm(`Delete client "${row.original.name}"? This cannot be undone.`)) {
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
    data: clients ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Clients</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="mb-6 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
      >
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                placeholder="Name"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-phone">Phone</Label>
              <Input
                id="client-phone"
                placeholder="Phone"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-email">Email</Label>
              <Input
                id="client-email"
                placeholder="Email (optional)"
                type="email"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="address">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-address">Address</Label>
              <Input
                id="client-address"
                placeholder="Address (optional)"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
        <div className="flex items-center gap-3 sm:col-span-2">
          {editingClientId !== null ? (
            <>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEditing}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add Client'}
            </Button>
          )}
        </div>
      </form>

      {createMutation.isError && (
        <p className="mb-4 text-sm text-destructive">{createMutation.error.message}</p>
      )}
      {statusMutation.isError && (
        <p className="mb-4 text-sm text-destructive">{statusMutation.error.message}</p>
      )}
      {updateMutation.isError && (
        <p className="mb-4 text-sm text-destructive">{updateMutation.error.message}</p>
      )}
      {deleteMutation.isError && (
        <p className="mb-4 text-sm text-destructive">{deleteMutation.error.message}</p>
      )}

      <p className="mb-4 text-lg font-semibold">
        Total trust fund holdings: {formatCurrency(trustFundBalances.reduce((sum, b) => sum + b.current, 0))}
      </p>

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
                No clients yet.
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
