import { BaseQuery, PaginationRes } from '@/schemaValidations/util.schema'
import z from 'zod'

export const InventoryStockQuery = BaseQuery.and(
  z.object({
    ingredientName: z.string().trim().max(256).optional(),
    lowStock: z.coerce.boolean().optional() // Lọc hàng tồn kho thấp (quantity < minStock)
  })
)

export type InventoryStockQueryType = z.TypeOf<typeof InventoryStockQuery>

export const InventoryBatchSchema = z.object({
  id: z.number(),
  inventoryStockId: z.number(),
  batchNumber: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  importDate: z.date(),
  expiryDate: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const InventoryStockSchema = z.object({
  id: z.number(),
  ingredientId: z.number(),
  quantity: z.number(),
  minStock: z.number().nullable(),
  maxStock: z.number().nullable(),
  avgUnitPrice: z.number(),
  totalValue: z.number(),
  lastImport: z.date().nullable(),
  lastExport: z.date().nullable(),
  updatedAt: z.date(),
  ingredientName: z.string().optional(),
  ingredientCategory: z.string().nullable().optional(),
  ingredientImage: z.string().nullable().optional(),
  batchCount: z.number().optional(),
  batches: z.array(InventoryBatchSchema).optional()
})

export const InventoryStockRes = z.object({
  data: InventoryStockSchema,
  message: z.string()
})

export type InventoryStockResType = z.TypeOf<typeof InventoryStockRes>

export const InventoryStockListRes = z.object({
  data: z.array(InventoryStockSchema),
  pagination: PaginationRes,
  message: z.string()
})

export type InventoryStockListResType = z.TypeOf<typeof InventoryStockListRes>

export const CreateInventoryStockBody = z.object({
  ingredientId: z.number(),
  quantity: z.number().min(0).default(0),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  avgUnitPrice: z.number().min(0).default(0),
  totalValue: z.number().min(0).default(0)
})

export type CreateInventoryStockBodyType = z.TypeOf<typeof CreateInventoryStockBody>

export const UpdateInventoryStockBody = z.object({
  quantity: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  avgUnitPrice: z.number().min(0).optional(),
  totalValue: z.number().min(0).optional()
})

export type UpdateInventoryStockBodyType = z.TypeOf<typeof UpdateInventoryStockBody>

export const InventoryStockParams = z.object({
  id: z.coerce.number()
})

export type InventoryStockParamsType = z.TypeOf<typeof InventoryStockParams>
