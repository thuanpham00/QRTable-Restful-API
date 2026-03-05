import { BaseQuery, PaginationRes } from '@/schemaValidations/util.schema'
import z from 'zod'

export const IngredientQuery = BaseQuery.and(
  z.object({
    name: z.string().trim().max(256).optional(),
    category: z.string().optional(),
    pagination: z.string().optional()
  })
)

export type IngredientQueryType = z.TypeOf<typeof IngredientQuery>

export const CreateIngredientBody = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(10000).optional(),
  allergenType: z.string().optional(),
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isActive: z.boolean().optional(),
  category: z.string().optional(),
  image: z.string().url().optional()
})

export type CreateIngredientBodyType = z.TypeOf<typeof CreateIngredientBody>

export const UpdateIngredientBody = CreateIngredientBody.extend({})
export type UpdateIngredientBodyType = z.TypeOf<typeof UpdateIngredientBody>

export const IngredientSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  allergenType: z.string().nullable(),
  isVegetarian: z.boolean(),
  isVegan: z.boolean(),
  category: z.string().nullable(),
  image: z.string(),
  isActive: z.boolean(),
  countDishUsed: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const IngredientRes = z.object({
  data: IngredientSchema,
  message: z.string()
})

export type IngredientResType = z.TypeOf<typeof IngredientRes>

export const IngredientListRes = z.object({
  data: z.array(IngredientSchema),
  message: z.string(),
  pagination: PaginationRes.nullable()
})

export type IngredientListResType = z.TypeOf<typeof IngredientListRes>

export const IngredientParams = z.object({
  id: z.coerce.number()
})
export type IngredientParamsType = z.TypeOf<typeof IngredientParams>

export const IngredientListWithPaginationQuery = z.object({
  page: z.coerce.number().positive().lte(10000).default(1),
  limit: z.coerce.number().positive().lte(10000).default(10)
})

export type IngredientListWithPaginationQueryType = z.TypeOf<typeof IngredientListWithPaginationQuery>

export const IngredientListWithPaginationRes = z.object({
  data: z.object({
    totalItem: z.number(),
    totalPage: z.number(),
    page: z.number(),
    limit: z.number(),
    items: z.array(IngredientSchema)
  }),
  message: z.string()
})

export type IngredientListWithPaginationResType = z.TypeOf<typeof IngredientListWithPaginationRes>
