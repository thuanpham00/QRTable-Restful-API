import { DishSnapshotSchema } from '@/schemaValidations/order.schema'
import z from 'zod'

export const TableSessionParams = z.object({
  id: z.coerce.number()
})
export type TableSessionParamsType = z.TypeOf<typeof TableSessionParams>

// Schema cho Order trong TableSession
export const OrderInSessionRes = z.object({
  id: z.number(),
  guestId: z.number().nullable(),
  tableNumber: z.number().nullable(),
  dishSnapshotId: z.number(),
  dishSnapshot: DishSnapshotSchema,
  quantity: z.number(),
  orderHandlerId: z.number().nullable(),
  paymentId: z.number().nullable(),
  tableSessionId: z.number().nullable(),
  orderMode: z.string(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Schema cho Guest trong TableSession
export const GuestInSessionRes = z.object({
  id: z.number(),
  name: z.string(),
  tableNumber: z.number().nullable(),
  dietaryPreferences: z.string().nullable(),
  allergyInfo: z.string().nullable(),
  refreshToken: z.string().nullable(),
  refreshTokenExpiresAt: z.date().nullable(),
  tableSessionId: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Schema cho Payment trong PaymentGroup
export const PaymentInGroupRes = z.object({
  id: z.number(),
  paymentMethod: z.string(),
  totalAmount: z.number(),
  status: z.string(),
  sepayTransactionId: z.number().nullable(),
  sepayReferenceCode: z.string().nullable(),
  sepayGateway: z.string().nullable(),
  sepayTransactionDate: z.date().nullable(),
  sepayContent: z.string().nullable(),
  guestId: z.number().nullable(),
  tableNumber: z.number().nullable(),
  paymentGroupId: z.number().nullable(),
  note: z.string().nullable(),
  createdById: z.number().nullable(),
  guest: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullable(),
  orders: z.array(OrderInSessionRes),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Schema cho Individual Payment (không có PaymentGroup)
export const IndividualPaymentRes = z.object({
  id: z.number(),
  paymentMethod: z.string(),
  totalAmount: z.number(),
  status: z.string(),
  sepayTransactionId: z.number().nullable(),
  sepayReferenceCode: z.string().nullable(),
  sepayGateway: z.string().nullable(),
  sepayTransactionDate: z.date().nullable(),
  sepayContent: z.string().nullable(),
  guestId: z.number().nullable(),
  tableNumber: z.number().nullable(),
  paymentGroupId: z.number().nullable(),
  note: z.string().nullable(),
  createdById: z.number().nullable(),
  guest: z.object({
    id: z.number(),
    name: z.string()
  }),
  orders: z.array(OrderInSessionRes),
  createdBy: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Schema cho PaymentGroup Summary (dùng cho LIST - không có nested)
export const PaymentGroupSummaryRes = z.object({
  id: z.number(),
  tableNumber: z.number(),
  totalAmount: z.number(),
  paymentMethod: z.string(),
  status: z.string(),
  note: z.string().nullable(),
  createdById: z.number(),
  sepayTransactionId: z.string().nullable(),
  sepayReferenceCode: z.string().nullable(),
  sepayGateway: z.string().nullable(),
  sepayTransactionDate: z.date().nullable(),
  sepayContent: z.string().nullable(),
  tableSessionId: z.number().nullable(), // optional có thể có hoặc ko - còn nullable là có thể null hoặc có giá trị
  createdAt: z.date(),
  updatedAt: z.date()
})

// Schema cho PaymentGroup Full (dùng cho DETAIL - có đầy đủ nested)
export const PaymentGroupInSessionRes = z.object({
  id: z.number(),
  tableNumber: z.number(),
  totalAmount: z.number(),
  paymentMethod: z.string(),
  status: z.string(),
  note: z.string().nullable(),
  createdById: z.number(),
  sepayTransactionId: z.string().nullable(),
  sepayReferenceCode: z.string().nullable(),
  sepayGateway: z.string().nullable(),
  sepayTransactionDate: z.date().nullable(),
  sepayContent: z.string().nullable(),
  tableSessionId: z.number().nullable(),
  payments: z.array(PaymentInGroupRes),
  createdBy: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Schema chính cho TableSession LIST (lightweight - không có nested payments)
export const TableSessionSchema = z.object({
  id: z.number(),
  tableNumber: z.number(),
  startTime: z.date(),
  endTime: z.date().nullable(),
  status: z.string(),
  totalRevenue: z.number(),
  guestCount: z.number(),
  orderCount: z.number(),
  note: z.string().nullable(),
  orders: z.array(OrderInSessionRes),
  guests: z.array(GuestInSessionRes),
  paymentGroups: z.array(PaymentGroupSummaryRes),
  createdAt: z.date(),
  updatedAt: z.date()
})
export type TableSessionSchemaType = z.TypeOf<typeof TableSessionSchema>

export const TableSessionActiveSchema = z.object({
  id: z.number(),
  tableNumber: z.number(),
  startTime: z.date(),
  endTime: z.date().nullable(),
  status: z.string(),
  totalRevenue: z.number(),
  guestCount: z.number(),
  orderCount: z.number(),
  note: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),

  dishesBeenServed: z.boolean().optional() // Trường mới để check đã có món nào được phục vụ chưa
})
export type TableSessionActiveSchemaType = z.TypeOf<typeof TableSessionActiveSchema>

export const TableSessionActiveRes = z.object({
  data: TableSessionActiveSchema.nullable(),
  message: z.string()
})
export type TableSessionActiveResType = z.TypeOf<typeof TableSessionActiveRes>

export const TableSessionActiveListRes = z.object({
  data: z.array(TableSessionActiveSchema).nullable(),
  message: z.string()
})
export type TableSessionActiveListResType = z.TypeOf<typeof TableSessionActiveListRes>

export const TableSessionListRes = z.object({
  data: z.array(TableSessionSchema),
  message: z.string()
})

export type TableSessionListResType = z.TypeOf<typeof TableSessionListRes>

export const TableSessionDetailSchema = TableSessionSchema.extend({
  paymentType: z.enum(['group', 'individual']),
  paymentGroups: z.array(PaymentGroupInSessionRes),
  individualPayments: z.array(IndividualPaymentRes)
})
export type TableSessionDetailSchemaType = z.TypeOf<typeof TableSessionDetailSchema>

export const TableSessionDetailRes = z.object({
  data: TableSessionDetailSchema,
  message: z.string()
})
export type TableSessionDetailResType = z.TypeOf<typeof TableSessionDetailRes>
