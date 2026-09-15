import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const loans = sqliteTable('loans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id').notNull().references(() => clients.id),
  principal: real('principal').notNull(),
  interestRate: real('interest_rate').notNull(), // total rate for the full term, e.g. 18 = 18%
  interestType: text('interest_type', { enum: ['fixed', 'declining'] }).notNull(),
  termMonths: integer('term_months').notNull(),
  repaymentFrequency: text('repayment_frequency', {
    enum: ['daily', 'weekly', 'biweekly', 'monthly'],
  }).notNull().default('monthly'),
  startDate: integer('start_date', { mode: 'timestamp' }),
  status: text('status', {
    enum: ['pending', 'active', 'overdue', 'paid_off', 'defaulted'],
  }).notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// One row per installment in the generated amortization schedule
export const installments = sqliteTable('installments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loanId: integer('loan_id').notNull().references(() => loans.id),
  installmentNumber: integer('installment_number').notNull(),
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  principalPortion: real('principal_portion').notNull(),
  interestPortion: real('interest_portion').notNull(),
  totalDue: real('total_due').notNull(),
  amountPaid: real('amount_paid').notNull().default(0),
  status: text('status', { enum: ['pending', 'partial', 'paid', 'overdue'] })
    .notNull()
    .default('pending'),
})

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loanId: integer('loan_id').notNull().references(() => loans.id),
  installmentId: integer('installment_id').references(() => installments.id),
  amount: real('amount').notNull(),
  method: text('method', { enum: ['cash', 'bank_transfer', 'card', 'other'] }).notNull().default('cash'),
  paidAt: integer('paid_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const clientsRelations = relations(clients, ({ many }) => ({
  loans: many(loans),
}))

export const loansRelations = relations(loans, ({ one, many }) => ({
  client: one(clients, { fields: [loans.clientId], references: [clients.id] }),
  installments: many(installments),
  payments: many(payments),
}))

export const installmentsRelations = relations(installments, ({ one, many }) => ({
  loan: one(loans, { fields: [installments.loanId], references: [loans.id] }),
  payments: many(payments),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  loan: one(loans, { fields: [payments.loanId], references: [loans.id] }),
  installment: one(installments, { fields: [payments.installmentId], references: [installments.id] }),
}))
