import z from 'zod'

// Schema cho Ingredient (nested)
const IngredientSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  image: z.string().nullable(),
  isActive: z.boolean(),
  unit: z.string()
})

// Schema cho InventoryStock (nested)
const InventoryStockNestedSchema = z.object({
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
  ingredient: IngredientSchema
})

// Schema cho InventoryBatch với relations
export const InventoryBatchWithRelationsSchema = z.object({
  id: z.number(),
  inventoryStockId: z.number(),
  batchNumber: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  status: z.enum(['Available', 'Low', 'Empty', 'Expired']),
  importDate: z.date(),
  expiryDate: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  inventoryStock: InventoryStockNestedSchema.optional()
})

export type InventoryBatchWithRelationsType = z.TypeOf<typeof InventoryBatchWithRelationsSchema>

// Response: Danh sách lô hàng
export const InventoryBatchListRes = z.object({
  data: z.array(InventoryBatchWithRelationsSchema),
  message: z.string()
})

export type InventoryBatchListResType = z.TypeOf<typeof InventoryBatchListRes>

// Params cho route
export const InventoryBatchParams = z.object({
  id: z.coerce.number() // inventoryStockId
})

export type InventoryBatchParamsType = z.TypeOf<typeof InventoryBatchParams>
