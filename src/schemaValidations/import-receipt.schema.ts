import { BaseQuery, PaginationRes } from '@/schemaValidations/util.schema'
import z from 'zod'

// Query params cho list ImportReceipt
export const ImportReceiptQuery = BaseQuery.and(
  z.object({
    supplierId: z.coerce.number().optional(), // Lọc theo nhà cung cấp
    status: z.enum(['Draft', 'Completed', 'Cancelled']).optional(), // Lọc theo trạng thái
    fromDate: z.coerce.date().optional(), // Từ ngày
    toDate: z.coerce.date().optional() // Đến ngày
  })
)

export type ImportReceiptQueryType = z.TypeOf<typeof ImportReceiptQuery>

// Schema cho ImportReceiptItem trong body
export const ImportReceiptItemBodySchema = z.object({
  supplierIngredientId: z.number().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  batchNumber: z.string().min(2).max(100),
  expiryDate: z.coerce.date(),
  note: z.string().optional()
})

export type ImportReceiptItemBodySchemaType = z.TypeOf<typeof ImportReceiptItemBodySchema>

// Schema cho ImportReceiptItem response
export const ImportReceiptItemSchema = z.object({
  id: z.number(),
  importReceiptId: z.number(),
  supplierIngredientId: z.number(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  batchNumber: z.string().nullable(),
  expiryDate: z.date().nullable(),
  note: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  ingredientName: z.string().optional(),
  ingredientUnit: z.string().optional(),
  ingredientImage: z.string().optional(),
  ingredientCategory: z.string().optional(),
  supplierName: z.string().optional()
})

export type ImportReceiptItemSchemaType = z.TypeOf<typeof ImportReceiptItemSchema>

// Schema cho ImportReceipt (với items)
export const ImportReceiptSchema = z.object({
  id: z.number(),
  code: z.string(),
  supplierId: z.number(),
  importDate: z.date(),
  totalAmount: z.number(),
  status: z.string(),
  note: z.string().nullable(),
  createdBy: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  supplierName: z.string().optional(),
  createdByName: z.string().optional(),
  items: z.array(ImportReceiptItemSchema).optional()
})

export type ImportReceiptSchemaType = z.TypeOf<typeof ImportReceiptSchema>

// Body cho create ImportReceipt
export const CreateImportReceiptBody = z.object({
  supplierId: z.number(),
  importDate: z.coerce.date().optional(),
  note: z.string().optional(),
  items: z.array(ImportReceiptItemBodySchema).min(1, 'Phải có ít nhất 1 item')
})

export type CreateImportReceiptBodyType = z.TypeOf<typeof CreateImportReceiptBody>

// Response cho create
export const CreateImportReceiptRes = z.object({
  data: ImportReceiptSchema,
  message: z.string()
})

export type CreateImportReceiptResType = z.TypeOf<typeof CreateImportReceiptRes>

// Body cho update ImportReceipt
export const UpdateImportReceiptBody = z.object({
  importDate: z.coerce.date().optional(),
  status: z.enum(['Draft', 'Completed', 'Cancelled']).optional(),
  note: z.string().optional(),
  items: z.array(ImportReceiptItemBodySchema).optional()
})

export type UpdateImportReceiptBodyType = z.TypeOf<typeof UpdateImportReceiptBody>

// Response cho update
export const UpdateImportReceiptRes = z.object({
  data: ImportReceiptSchema,
  message: z.string()
})

export type UpdateImportReceiptResType = z.TypeOf<typeof UpdateImportReceiptRes>

// Response cho get detail
export const GetImportReceiptDetailRes = z.object({
  data: ImportReceiptSchema,
  message: z.string()
})

export type GetImportReceiptDetailResType = z.TypeOf<typeof GetImportReceiptDetailRes>

// Response cho get list
export const GetImportReceiptListRes = z.object({
  data: z.array(ImportReceiptSchema),
  pagination: PaginationRes,
  message: z.string()
})

export type GetImportReceiptListResType = z.TypeOf<typeof GetImportReceiptListRes>

// Params cho get detail
export const ImportReceiptParams = z.object({
  id: z.coerce.number()
})

export type ImportReceiptParamsType = z.TypeOf<typeof ImportReceiptParams>
