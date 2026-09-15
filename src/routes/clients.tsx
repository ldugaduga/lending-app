import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import { listClients, createClient, updateClientStatus } from '@/server/clients'

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
        <button
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
        </button>
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
      <h1>Clients</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}
      >
        <form.Field name="name">
          {(field) => (
            <input placeholder="Name" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <input placeholder="Phone" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <input placeholder="Email (optional)" type="email" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
          )}
        </form.Field>
        <form.Field name="address">
          {(field) => (
            <input placeholder="Address (optional)" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
          )}
        </form.Field>
        <button type="submit">Add Client</button>
      </form>

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
