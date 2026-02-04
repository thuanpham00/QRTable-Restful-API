import envConfig from '@/config'
import { DishStatus, MenuItemStatus, OrderStatus, Role, TableStatus } from '@/constants/type'
import prisma from '@/database'
import { GuestCreateOrdersBodyType, GuestLoginBodyType } from '@/schemaValidations/guest.schema'
import { TokenPayload } from '@/types/jwt.types'
import { AuthError, StatusError } from '@/utils/errors'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt'
import ms from 'ms'

export const guestLoginController = async (body: GuestLoginBodyType) => {
  const table = await prisma.table.findUnique({
    where: {
      number: body.tableNumber,
      token: body.token
    }
  })
  if (!table) {
    throw new Error('Bàn không tồn tại hoặc mã token không đúng')
  }

  if (table.status === TableStatus.Hidden) {
    throw new Error('Bàn này đã bị ẩn, hãy chọn bàn khác để đăng nhập')
  }

  if (table.status === TableStatus.Reserved) {
    throw new Error('Bàn đã được đặt trước, hãy liên hệ nhân viên để được hỗ trợ')
  }

  let guest = await prisma.guest.create({
    data: {
      name: body.name,
      tableNumber: body.tableNumber
    }
  })
  const refreshToken = signRefreshToken(
    {
      userId: guest.id,
      role: Role.Guest
    },
    {
      expiresIn: ms(envConfig.GUEST_REFRESH_TOKEN_EXPIRES_IN)
    }
  )
  const accessToken = signAccessToken(
    {
      userId: guest.id,
      role: Role.Guest
    },
    {
      expiresIn: ms(envConfig.GUEST_ACCESS_TOKEN_EXPIRES_IN)
    }
  )
  const decodedRefreshToken = verifyRefreshToken(refreshToken)
  const refreshTokenExpiresAt = new Date(decodedRefreshToken.exp * 1000)

  guest = await prisma.guest.update({
    where: {
      id: guest.id
    },
    data: {
      refreshToken,
      refreshTokenExpiresAt
    }
  })

  return {
    guest,
    accessToken,
    refreshToken
  }
}

export const guestLogoutController = async (id: number) => {
  await prisma.guest.update({
    where: {
      id
    },
    data: {
      refreshToken: null,
      refreshTokenExpiresAt: null
    }
  })
  return 'Đăng xuất thành công'
}

export const guestRefreshTokenController = async (refreshToken: string) => {
  let decodedRefreshToken: TokenPayload
  try {
    decodedRefreshToken = verifyRefreshToken(refreshToken)
  } catch (error) {
    throw new AuthError('Refresh token không hợp lệ')
  }
  const newRefreshToken = signRefreshToken({
    userId: decodedRefreshToken.userId,
    role: Role.Guest,
    exp: decodedRefreshToken.exp
  })
  const newAccessToken = signAccessToken(
    {
      userId: decodedRefreshToken.userId,
      role: Role.Guest
    },
    {
      expiresIn: ms(envConfig.GUEST_ACCESS_TOKEN_EXPIRES_IN)
    }
  )
  await prisma.guest.update({
    where: {
      id: decodedRefreshToken.userId
    },
    data: {
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt: new Date(decodedRefreshToken.exp * 1000)
    }
  })

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  }
}

export const guestCreateOrdersController = async (guestId: number, body: GuestCreateOrdersBodyType) => {
  const result = await prisma.$transaction(async (tx) => {
    const guest = await tx.guest.findUniqueOrThrow({
      where: {
        id: guestId
      }
    })
    if (guest.tableNumber === null) {
      throw new Error('Bàn của bạn đã bị xóa, vui lòng đăng xuất và đăng nhập lại một bàn mới')
    }
    const table = await tx.table.findUniqueOrThrow({
      where: {
        number: guest.tableNumber
      }
    })
    if (table.status === TableStatus.Hidden) {
      throw new Error(`Bàn ${table.number} đã bị ẩn, vui lòng đăng xuất và chọn bàn khác`)
    }
    if (table.status === TableStatus.Reserved) {
      throw new Error(`Bàn ${table.number} đã được đặt trước, vui lòng đăng xuất và chọn bàn khác`)
    }
    const orders = await Promise.all(
      body.listOrder.map(async (order) => {
        const menuItem = await tx.menuItem.findUniqueOrThrow({
          where: {
            id: order.menuItemId
          },
          include: {
            dish: true
          }
        })

        // Kiểm tra trạng thái MenuItem
        if (menuItem.status === MenuItemStatus.HIDDEN) {
          throw new Error(`Món ăn không khả dụng trong menu`)
        }
        if (menuItem.status === MenuItemStatus.OUT_OF_STOCK) {
          throw new Error(`Món ăn tạm thời hết hàng`)
        }

        // Kiểm tra trạng thái Dish gốc
        const dish = menuItem.dish
        if (dish.status === DishStatus.Discontinued) {
          throw new Error(`Món ${dish.name} đã ngừng phục vụ`)
        }

        // +1 lần popularity của món ăn
        await tx.dish.update({
          where: { id: dish.id },
          data: {
            popularity: { increment: 1 }
          }
        })

        const dishSnapshot = await tx.dishSnapshot.create({
          data: {
            name: dish.name,
            description: dish.description,
            image: dish.image,
            status: menuItem.status,
            price: menuItem.price, // LẤY GIÁ TẠI THỜI ĐIỂM ĐẶT - dùng giá trong menuItem - ko dùng giá gốc món ăn
            menuItemId: menuItem.id
          }
        })
        const orderRecord = await tx.order.create({
          data: {
            guestId,
            tableNumber: guest.tableNumber,
            dishSnapshotId: dishSnapshot.id,
            quantity: order.quantity,
            orderMode: body.typeOrder,
            orderHandlerId: null,
            status: OrderStatus.Pending
          },
          include: {
            dishSnapshot: true,
            guest: true,
            orderHandler: true
          }
        })
        type OrderRecord = typeof orderRecord
        return orderRecord as OrderRecord & {
          status: (typeof OrderStatus)[keyof typeof OrderStatus]
          dishSnapshot: OrderRecord['dishSnapshot'] & {
            status: (typeof DishStatus)[keyof typeof DishStatus]
          }
        }
      })
    )
    return orders
  })
  return result
}

export const guestGetOrdersController = async (guestId: number) => {
  const orders = await prisma.order.findMany({
    where: {
      guestId
    },
    include: {
      dishSnapshot: true,
      orderHandler: true,
      guest: true
    }
  })
  return orders
}
