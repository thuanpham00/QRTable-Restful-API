import { DishStatusValues } from '@/constants/type'
import { IngredientSchema } from '@/schemaValidations/ingredient.schema'
import { BaseQuery, PaginationRes } from '@/schemaValidations/util.schema'
import z from 'zod'

export const DishQuery = BaseQuery.and(
  z.object({
    name: z.string().trim().max(256).optional(),
    categoryId: z.string().optional(),
    pagination: z.string().optional()
  })
)

export type DishQueryType = z.TypeOf<typeof DishQuery>

export const CreateDishBody = z.object({
  name: z.string().min(5).max(256),
  price: z.number().min(1000),
  description: z.string().max(10000).optional(),
  image: z.string().url(),
  status: z.enum(DishStatusValues).optional(),
  categoryId: z.string(), // bắt buộc chọn

  spicyLevel: z.number(),
  preparationTime: z.number().min(1),
  popularity: z.number().optional(),
  dietaryTags: z.string().optional(),
  searchKeywords: z.string().optional()
})

export type CreateDishBodyType = z.TypeOf<typeof CreateDishBody>

export const UpdateDishBody = CreateDishBody.extend({
  categoryId: z.string().optional()
})
export type UpdateDishBodyType = z.TypeOf<typeof UpdateDishBody>

export const dishIngredientSchema = z.object({
  id: z.number(),
  dishId: z.number(),
  ingredientId: z.number(),
  ingredient: IngredientSchema,
  quantity: z.string(),
  unit: z.string(),
  isOptional: z.boolean(),
  isMain: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const DishSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.coerce.number(),
  description: z.string(),
  image: z.string(),
  status: z.enum(DishStatusValues),
  categoryId: z.number(),
  category: z.object({
    id: z.number(),
    name: z.string()
  }),

  dietaryTags: z.string().nullable(),
  spicyLevel: z.number(),
  preparationTime: z.number(),
  searchKeywords: z.string(),
  popularity: z.number(),

  ingredients: z.array(z.string()).nullable().optional(),

  createdAt: z.date(),
  updatedAt: z.date()
})

export const DishRes = z.object({
  data: DishSchema,
  message: z.string()
})

export type DishResType = z.TypeOf<typeof DishRes>

export const DishListRes = z.object({
  data: z.array(DishSchema),
  message: z.string(),
  pagination: PaginationRes.nullable()
})

export type DishListResType = z.TypeOf<typeof DishListRes>

export const DishParams = z.object({
  id: z.coerce.number()
})
export type DishParamsType = z.TypeOf<typeof DishParams>

export const DishListWithPaginationQuery = z.object({
  page: z.coerce.number().positive().lte(10000).default(1),
  limit: z.coerce.number().positive().lte(10000).default(10)
})

export type DishListWithPaginationQueryType = z.TypeOf<typeof DishListWithPaginationQuery>

export const DishListWithPaginationRes = z.object({
  data: z.object({
    totalItem: z.number(),
    totalPage: z.number(),
    page: z.number(),
    limit: z.number(),
    items: z.array(DishSchema)
  }),
  message: z.string()
})

export type DishListWithPaginationResType = z.TypeOf<typeof DishListWithPaginationRes>

export const DishIngredientRes = z.object({
  data: dishIngredientSchema,
  message: z.string()
})

export type DishIngredientResType = z.TypeOf<typeof DishIngredientRes>

export const DishIngredientListRes = z.object({
  data: z.array(dishIngredientSchema),
  message: z.string()
})

export type DishIngredientListResType = z.TypeOf<typeof DishIngredientListRes>

export const AddIngredientToDish = z.object({
  dishId: z.number(),
  ingredientId: z.number(),
  quantity: z.number().min(1),
  unit: z.string(),
  isOptional: z.boolean().optional(),
  isMain: z.boolean().optional()
})

export type AddIngredientToDishType = z.TypeOf<typeof AddIngredientToDish>

export const UpdateIngredientInDish = AddIngredientToDish

export type UpdateIngredientInDishType = z.TypeOf<typeof UpdateIngredientInDish>
