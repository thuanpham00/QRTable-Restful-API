import envConfig from '@/config'
import { DishStatus, ManagerRoom, MenuItemStatus, OrderStatus, Role, TableStatus } from '@/constants/type'
import prisma from '@/database'
import { GuestCreateOrdersBodyType, GuestLoginBodyType, UpdateGuestBodyType } from '@/schemaValidations/guest.schema'
import { TokenPayload } from '@/types/jwt.types'
import { AuthError } from '@/utils/errors'
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

  if (table.status === TableStatus.Available) {
    await prisma.table.update({
      where: { number: body.tableNumber },
      data: { status: TableStatus.Serving }
    })
  }

  let guest = await prisma.guest.create({
    data: {
      name: body.name,
      tableNumber: body.tableNumber,
      dietaryPreferences: body.dietaryPreferences || null,
      allergyInfo: body.allergyInfo || null
    }
  })

  const activeSession = await prisma.tableSession.findFirst({
    where: {
      tableNumber: body.tableNumber,
      status: 'Active'
    }
  }) // kiểm tra coi có phiên nào thuộc bàn đó đang active không

  let sessionId: number
  if (!activeSession) {
    // Tạo session mới khi là guest đầu tiên
    const newSession = await prisma.tableSession.create({
      data: {
        tableNumber: body.tableNumber,
        guestCount: 1,
        status: 'Active'
      }
    })
    sessionId = newSession.id
  } else {
    // Join session có sẵn
    await prisma.tableSession.update({
      where: { id: activeSession.id },
      data: {
        guestCount: { increment: 1 }
      }
    })
    sessionId = activeSession.id
  }

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
      refreshTokenExpiresAt,
      tableSessionId: sessionId
    }
  })

  // tạo mẫu 1 đoạn chat AI xin chào
  await prisma.chatHistory.create({
    data: {
      sessionId: String(sessionId),
      guestId: guest.id,
      message: '',
      response: 'Xin chào! Tôi là AI assistant của nhà hàng. Tôi có thể giúp gì cho bạn?',
      intent: 'greeting'
    }
  })

  return {
    guest,
    accessToken,
    refreshToken
  }
}

export const guestLogoutController = async (id: number, io?: any) => {
  const guest = await prisma.guest.findUniqueOrThrow({
    where: { id }
  })

  await prisma.guest.update({
    where: {
      id
    },
    data: {
      refreshToken: null,
      refreshTokenExpiresAt: null
    }
  })
  // Guest Logout - Set Available khi guest cuối cùng rời bàn:

  const remainingGuests = await prisma.guest.count({
    where: {
      tableNumber: guest.tableNumber,
      id: { not: id }, // Trừ guest đang logout
      refreshToken: { not: null } // Chỉ đếm guest còn active
    }
  })
  // ✅ Nếu không còn guest nào → Set Available
  if (remainingGuests === 0 && guest.tableNumber) {
    if (guest.tableSessionId) {
      await prisma.tableSession.update({
        where: { id: guest.tableSessionId },
        data: { status: 'Completed', endTime: new Date(), guestCount: 0 }
      })
    }
    await prisma.table.update({
      where: { number: guest.tableNumber },
      data: { status: TableStatus.Available }
    })
    io.to(ManagerRoom).emit('update-status-table') // cập nhật trạng thái bàn
  } else if (guest.tableSessionId) {
    await prisma.tableSession.update({
      where: { id: guest.tableSessionId },
      data: { guestCount: { decrement: 1 } }
    })
  }

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
  const guest = await prisma.guest.findUniqueOrThrow({
    where: {
      id: guestId
    }
  })
  const result = await prisma.$transaction(
    async (tx) => {
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
              status: OrderStatus.Pending,
              tableSessionId: guest.tableSessionId,
              note: order.note
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
    },
    {
      maxWait: 10000,
      timeout: 15000
    }
  )
  if (guest.tableSessionId) {
    await prisma.tableSession.update({
      where: { id: guest.tableSessionId },
      data: {
        orderCount: { increment: result.length }
      }
    })
  }
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

export const guestGetPaymentsController = async (guestId: number) => {
  const payments = await prisma.payment.findMany({
    where: {
      guestId
    },
    include: {
      guest: {
        select: {
          id: true,
          name: true,
          tableNumber: true,
          dietaryPreferences: true,
          allergyInfo: true,
          createdAt: true,
          updatedAt: true
        }
      },
      orders: {
        include: {
          dishSnapshot: true,
          orderHandler: true,
          guest: true
        }
      }
    }
  })
  const formattedPayments = payments.map((payment) => ({
    id: payment.id,
    totalAmount: payment.totalAmount,
    paymentMethod: payment.paymentMethod,
    status: payment.status,
    guest: payment.guest,
    orders: payment.orders,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  }))
  return formattedPayments
}
