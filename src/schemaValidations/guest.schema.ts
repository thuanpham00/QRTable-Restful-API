import { OrderModeTypeValues, Role, DietaryPreferenceValues, AllergenValues } from '@/constants/type'
import { OrderSchema } from '@/schemaValidations/order.schema'
import z from 'zod'

// Helper để validate comma-separated string hoặc array
const dietaryPreferencesSchema = z
  .union([
    z.array(z.enum(DietaryPreferenceValues)), // Array: ["vegetarian", "vegan"]
    z.string().refine(
      (val) => {
        if (!val) return true
        const items = val.split(',').map((s) => s.trim())
        return items.every((item) => DietaryPreferenceValues.includes(item as any))
      },
      { message: 'Invalid dietary preference value' }
    ) // String: "vegetarian,vegan"
  ])
  .optional()
  .transform((val) => {
    // Chuyển array thành string để lưu DB
    if (Array.isArray(val)) return val.join(',')
    return val
  })

const allergyInfoSchema = z
  .union([
    z.array(z.enum(AllergenValues)), // Array: ["shellfish", "dairy"]
    z.string().refine(
      (val) => {
        if (!val) return true
        const items = val.split(',').map((s) => s.trim())
        return items.every((item) => AllergenValues.includes(item as any))
      },
      { message: 'Invalid allergen value' }
    ) // String: "shellfish,dairy"
  ])
  .optional()
  .transform((val) => {
    // Chuyển array thành string để lưu DB
    if (Array.isArray(val)) return val.join(',')
    return val
  })

export const GuestLoginBody = z
  .object({
    name: z.string().min(2).max(50),
    tableNumber: z.number(),
    token: z.string(),
    dietaryPreferences: dietaryPreferencesSchema,
    allergyInfo: allergyInfoSchema
  })
  .strict()

export type GuestLoginBodyType = z.TypeOf<typeof GuestLoginBody>

export const GuestLoginRes = z.object({
  data: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    guest: z.object({
      id: z.number(),
      name: z.string(),
      role: z.enum([Role.Guest]),
      tableNumber: z.number().nullable(),
      dietaryPreferences: z.string().nullable(),
      allergyInfo: z.string().nullable(),
      createdAt: z.date(),
      updatedAt: z.date()
    })
  }),
  message: z.string()
})

export type GuestLoginResType = z.TypeOf<typeof GuestLoginRes>

export const GuestCreateOrdersBody = z.object({
  listOrder: z.array(
    z.object({
      menuItemId: z.number(),
      quantity: z.number(),
      note: z.string().nullable()
    })
  ),
  typeOrder: z.enum(OrderModeTypeValues)
})

export type GuestCreateOrdersBodyType = z.TypeOf<typeof GuestCreateOrdersBody>

export const GuestCreateOrdersRes = z.object({
  message: z.string(),
  data: z.array(OrderSchema)
})

export type GuestCreateOrdersResType = z.TypeOf<typeof GuestCreateOrdersRes>

export const GuestGetOrdersRes = GuestCreateOrdersRes

export type GuestGetOrdersResType = z.TypeOf<typeof GuestGetOrdersRes>

export const GuestSchema = z.object({
  id: z.number(),
  name: z.string(),
  tableNumber: z.number(),
  dietaryPreferences: z.string().nullable(),
  allergyInfo: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type GuestSchemaType = z.TypeOf<typeof GuestSchema>

// GuestGetPaymentsRes schema
export const GuestGetPaymentsRes = z.object({
  message: z.string(),
  data: z.array(
    z.object({
      id: z.number(),
      totalAmount: z.number(),
      paymentMethod: z.string(),
      status: z.string(),
      guest: GuestSchema,
      orders: z.array(OrderSchema),
      createdAt: z.date(),
      updatedAt: z.date()
    })
  )
})

export type GuestGetPaymentsResType = z.TypeOf<typeof GuestGetPaymentsRes>

// Update guest profile (sau khi đăng nhập)
export const UpdateGuestBody = z
  .object({
    name: z.string().min(2).max(50).optional(),
    dietaryPreferences: dietaryPreferencesSchema,
    allergyInfo: allergyInfoSchema
  })
  .strict()

export type UpdateGuestBodyType = z.TypeOf<typeof UpdateGuestBody>

export const UpdateGuestRes = z.object({
  data: GuestSchema,
  message: z.string()
})

export type UpdateGuestResType = z.TypeOf<typeof UpdateGuestRes>
