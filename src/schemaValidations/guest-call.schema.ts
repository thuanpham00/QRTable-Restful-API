import { GuestCallValues } from '@/constants/type'
import { AccountSchema } from '@/schemaValidations/account.schema'
import { GuestSchema } from '@/schemaValidations/guest.schema'
import z from 'zod'

export const GuestCallSchema = z.object({
  id: z.number(),
  guestId: z.number(),
  tableNumber: z.number(),
  status: z.enum(GuestCallValues),
  accountId: z.number().nullable(),
  guest: GuestSchema,
  account: AccountSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const GuestCallListRes = z.object({
  data: z.array(GuestCallSchema),
  message: z.string()
})

export type GuestCallListResType = z.TypeOf<typeof GuestCallListRes>

export const GuestCallRes = z.object({
  data: GuestCallSchema,
  message: z.string()
})

export type GuestCallResType = z.TypeOf<typeof GuestCallRes>

export const GuestCallCountRes = z.object({
  message: z.string(),
  data: z.number()
})

export type GuestCallCountResType = z.TypeOf<typeof GuestCallCountRes>
