import z from 'zod'

export const SupplierIngredientSchema = z.object({
  id: z.number(),
  supplierId: z.number(),
  ingredientId: z.number(),
  price: z.number(),
  isPreferred: z.boolean(),
  note: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Include relations nếu cần
  supplier: z
    .object({
      id: z.number(),
      name: z.string(),
      code: z.string()
    })
    .optional(),
  ingredient: z
    .object({
      id: z.number(),
      name: z.string(),
      category: z.string().nullable(),
      image: z.string().nullable(),
      unit: z.string()
    })
    .optional()
})

export const SupplierIngredientRes = z.object({
  data: SupplierIngredientSchema,
  message: z.string()
})

export type SupplierIngredientResType = z.TypeOf<typeof SupplierIngredientRes>

export const SupplierIngredientListRes = z.object({
  data: z.array(SupplierIngredientSchema),
  message: z.string()
})

export type SupplierIngredientListResType = z.TypeOf<typeof SupplierIngredientListRes>

export const CreateSupplierIngredientBody = z.object({
  supplierId: z.number(),
  ingredientId: z.number(),
  price: z.number().min(0),
  isPreferred: z.boolean().default(false),
  note: z.string().max(2000).optional()
})

export type CreateSupplierIngredientBodyType = z.TypeOf<typeof CreateSupplierIngredientBody>

export const UpdateSupplierIngredientBody = z.object({
  price: z.number().min(0).optional(),
  isPreferred: z.boolean().optional(),
  note: z.string().max(2000).optional()
})

export type UpdateSupplierIngredientBodyType = z.TypeOf<typeof UpdateSupplierIngredientBody>

export const SupplierIngredientParams = z.object({
  id: z.coerce.number()
})

export type SupplierIngredientParamsType = z.TypeOf<typeof SupplierIngredientParams>

export const SupplierIngredientParams_2 = z.object({
  supplierId: z.coerce.number()
})

export type SupplierIngredientParams_2_Type = z.TypeOf<typeof SupplierIngredientParams_2>
