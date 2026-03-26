import { BaseQuery, PaginationRes } from '@/schemaValidations/util.schema'
import z from 'zod'

export const InventoryStockQuery = BaseQuery.and(
  z.object({
    ingredientName: z.string().trim().max(256).optional(),
    lowStock: z.string().optional() // Lọc hàng tồn kho thấp (quantity < minStock)
  })
)

export type InventoryStockQueryType = z.TypeOf<typeof InventoryStockQuery>

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
  ingredientCategory: z.string().optional(),
  ingredientImage: z.string().optional(),
  ingredientUnit: z.string().optional(),
  batchCount: z.number().optional()
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

export const InventoryStockListNoPaginationRes = z.object({
  data: z.array(InventoryStockSchema),
  message: z.string()
})

export type InventoryStockListNoPaginationResType = z.TypeOf<typeof InventoryStockListNoPaginationRes>

export const UpdateInventoryStockBody = z.object({
  minStock: z.number().min(0).nullable().optional(),
  maxStock: z.number().min(0).nullable().optional()
  // Chỉ cho phép update ngưỡng cảnh báo
})

export type UpdateInventoryStockBodyType = z.TypeOf<typeof UpdateInventoryStockBody>

export const InventoryStockParams = z.object({
  id: z.coerce.number()
})

export type InventoryStockParamsType = z.TypeOf<typeof InventoryStockParams>
