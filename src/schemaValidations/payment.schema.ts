import { PaginationRes } from '@/schemaValidations/util.schema'
import z from 'zod'

// ============ Body Schemas ============
export const CreatePaymentBody = z
  .object({
    guestId: z.number().int().positive().optional(),
    tableNumber: z.number().int().positive().optional(),
    orderIds: z.array(z.number().int().positive()).min(1, 'Phải có ít nhất 1 order'),
    totalAmount: z.number().int().positive('Số tiền phải lớn hơn 0'),
    paymentMethod: z.enum(['CASH', 'SEPAY']).default('SEPAY'),
    note: z.string().optional()
  })
  .strict()
  .refine((data) => data.guestId || data.tableNumber, {
    message: 'Phải cung cấp guestId hoặc tableNumber'
  })

export type CreatePaymentBodyType = z.infer<typeof CreatePaymentBody>

// ============ Body Schemas ============
export const CreatePaymentByTableBody = z
  .object({
    tableNumber: z.number().int().positive(),
    paymentMethod: z.enum(['CASH', 'SEPAY']).default('SEPAY'),
    guestIds: z.array(z.number().int().positive())
  })
  .strict()

export type CreatePaymentByTableBodyType = z.infer<typeof CreatePaymentByTableBody>

// ============ Param Schemas ============
export const PaymentIdParam = z.object({
  id: z.coerce.number().int().positive()
})

export type PaymentIdParamType = z.infer<typeof PaymentIdParam>

export const SepayWebhookBody = z.object({
  id: z.number(),
  gateway: z.string(),
  transactionDate: z.string(),
  accountNumber: z.string(),
  code: z.string().nullable(),
  content: z.string(),
  transferType: z.enum(['in', 'out']),
  transferAmount: z.number(),
  accumulated: z.number().nullable(),
  subAccount: z.string().nullable(),
  referenceCode: z.string().nullable(),
  description: z.string().nullable()
})

export type SepayWebhookBodyType = z.infer<typeof SepayWebhookBody>

// ============ Query Schemas ============
export const GetPaymentsQuery = z.object({
  paymentMethod: z.enum(['CASH', 'SEPAY']).optional(),
  numberTable: z.coerce.number().int().positive().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10)
})

export type GetPaymentsQueryType = z.infer<typeof GetPaymentsQuery>

// ============ Data Schemas ============
export const BankInfoSchema = z.object({
  bankCode: z.string(),
  accountNumber: z.string(),
  accountName: z.string(),
  amount: z.number(),
  content: z.string()
})

export const PaymentDataSchema = z.object({
  paymentId: z.number(),
  totalAmount: z.number(),
  status: z.string(),
  paymentMethod: z.string(),
  qrCodeUrl: z.string().optional(),
  bankInfo: BankInfoSchema.optional(),
  expiresIn: z.number().optional()
})

export const PaymentItemSchema = z.object({
  id: z.number(),
  paymentMethod: z.string(),
  totalAmount: z.number(),
  status: z.string(),
  guestId: z.number().nullable(),
  tableNumber: z.number().nullable(),
  note: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  guest: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullable(),
  table: z
    .object({
      number: z.number()
    })
    .nullable(),
  orders: z.array(
    z.object({
      id: z.number(),
      quantity: z.number()
    })
  ),
  createdBy: z.object({
    id: z.number(),
    name: z.string()
  }),
  sepayTransactionId: z.number().nullable(),
  sepayReferenceCode: z.string().nullable(),
  sepayGateway: z.string().nullable(),
  sepayTransactionDate: z.date().nullable(),
  sepayContent: z.string().nullable()
})

// ============ Response Schemas ============
export const CreatePaymentRes = z
  .object({
    message: z.string(),
    data: PaymentDataSchema
  })
  .strict()

export type CreatePaymentResType = z.infer<typeof CreatePaymentRes>

export const PaymentRes = z
  .object({
    data: PaymentItemSchema
  })
  .strict()

export type PaymentResType = z.infer<typeof PaymentRes>

export const PaymentListRes = z
  .object({
    data: z.array(PaymentItemSchema),
    pagination: PaginationRes
  })
  .strict()

export type PaymentListResType = z.infer<typeof PaymentListRes>

export const SepayWebhookRes = z
  .object({
    success: z.boolean(),
    message: z.string()
  })
  .strict()

export type SepayWebhookResType = z.infer<typeof SepayWebhookRes>

export const CreatePaymentTableRes = z
  .object({
    message: z.string(),
    data: z.array(PaymentDataSchema)
  })
  .strict()

export type CreatePaymentTableResType = z.infer<typeof CreatePaymentTableRes>
