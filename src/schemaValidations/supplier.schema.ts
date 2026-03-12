import { BaseQuery, PaginationRes } from '@/schemaValidations/util.schema'
import z from 'zod'

export const SupplierQuery = BaseQuery.and(
  z.object({
    name: z.string().trim().max(256).optional(),
    status: z.enum(['Active', 'Inactive']).optional()
  })
)

export type SupplierQueryType = z.TypeOf<typeof SupplierQuery>

export const SupplierSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  status: z.string(),
  note: z.string().nullable(),
  ingredientCount: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const SupplierRes = z.object({
  data: SupplierSchema,
  message: z.string()
})

export type SupplierResType = z.TypeOf<typeof SupplierRes>

export const SupplierListRes = z.object({
  data: z.array(SupplierSchema),
  pagination: PaginationRes,
  message: z.string()
})

export type SupplierListResType = z.TypeOf<typeof SupplierListRes>

export const CreateSupplierBody = z.object({
  name: z.string().min(2).max(256),
  code: z.string().min(2).max(50),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(256).optional(),
  address: z.string().max(1000).optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  note: z.string().max(2000).optional()
})

export type CreateSupplierBodyType = z.TypeOf<typeof CreateSupplierBody>

export const UpdateSupplierBody = z.object({
  name: z.string().min(2).max(256).optional(),
  code: z.string().min(2).max(50).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(256).optional(),
  address: z.string().max(1000).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  note: z.string().max(2000).optional()
})

export type UpdateSupplierBodyType = z.TypeOf<typeof UpdateSupplierBody>

export const SupplierParams = z.object({
  id: z.coerce.number()
})

export type SupplierParamsType = z.TypeOf<typeof SupplierParams>

// Schema cho dropdown/select options
export const SupplierOptionSchema = z.object({
  id: z.number(),
  name: z.string()
})

export const SupplierOptionsRes = z.object({
  data: z.array(SupplierOptionSchema),
  message: z.string()
})

export type SupplierOptionsResType = z.TypeOf<typeof SupplierOptionsRes>
