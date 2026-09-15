import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import { listClients, createClient, updateClientStatus } from '@/server/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export const Route = createFileRoute('/clients')({
  component: ClientsPage,
  loader: async () => listClients(),
})

type Client = Awaited<ReturnType<typeof listClients>>[number]
const columnHelper = createColumnHelper<Client>()

function ClientsPage() {
  const initialClients = Route.useLoaderData()
  const queryClient = useQueryClient()

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => listClients(),
    initialData: initialClients,
  })

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })

  const statusMutation = useMutation({
    mutationFn: updateClientStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })

  const form = useForm({
    defaultValues: { name: '', email: '', phone: '', address: '' },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({ data: value })
      form.reset()
    },
  })

  const columns = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('phone', { header: 'Phone' }),
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.accessor('status', { header: 'Status' }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
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
        className="mb-6 flex flex-wrap items-end gap-4"
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
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Adding...' : 'Add Client'}
        </Button>
      </form>

      {createMutation.isError && (
        <p className="mb-4 text-sm text-destructive">{createMutation.error.message}</p>
      )}
      {statusMutation.isError && (
        <p className="mb-4 text-sm text-destructive">{statusMutation.error.message}</p>
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
