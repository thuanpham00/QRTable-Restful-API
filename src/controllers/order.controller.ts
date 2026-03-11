import { DishStatus, MenuItemStatus, OrderStatus, TableStatus } from '@/constants/type'
import prisma from '@/database'
import { CreateOrdersBodyType, UpdateOrderBodyType } from '@/schemaValidations/order.schema'
import { exportIngredientFIFO, generateExportReceiptCode } from '@/utils/inventory-export.utils'

export const createOrdersController = async (orderHandlerId: number, body: CreateOrdersBodyType) => {
  const { guestId, orders } = body
  const guest = await prisma.guest.findUniqueOrThrow({
    where: {
      id: guestId
    },
    select: {
      id: true,
      tableNumber: true,
      tableSessionId: true,
      refreshToken: true,
      refreshTokenExpiresAt: true
    }
  })

  if (guest.tableNumber === null) {
    throw new Error('Bàn gắn liền với khách hàng này đã bị xóa, vui lòng chọn khách hàng khác!')
  }
  const table = await prisma.table.findUniqueOrThrow({
    where: {
      number: guest.tableNumber
    }
  })
  if (table.status === TableStatus.Hidden) {
    throw new Error(`Bàn ${table.number} gắn liền với khách hàng đã bị ẩn, vui lòng chọn khách hàng khác!`)
  }

  // dành cho khách ko login thì tại bước này update trạng thái table
  if (guest.refreshToken === null || guest.refreshTokenExpiresAt === null) {
    await prisma.table.update({
      where: { number: guest.tableNumber },
      data: {
        status: TableStatus.Serving
      }
    })
  }

  const [ordersRecord, socketRecord] = await Promise.all([
    prisma.$transaction(
      async (tx) => {
        const ordersRecord = await Promise.all(
          orders.map(async (order) => {
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
                description: dish.description,
                image: dish.image,
                name: dish.name,
                price: menuItem.price,
                menuItemId: menuItem.id,
                status: menuItem.status
              }
            })
            const orderRecord = await tx.order.create({
              data: {
                dishSnapshotId: dishSnapshot.id,
                guestId,
                quantity: order.quantity,
                tableNumber: guest.tableNumber,
                orderHandlerId,
                status: OrderStatus.Pending,
                orderMode: body.orderMode,
                tableSessionId: guest.tableSessionId
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

        return ordersRecord
      },
      {
        maxWait: 10000,
        timeout: 15000
      }
    ),
    prisma.socket.findUnique({
      where: {
        guestId: body.guestId
      }
    })
  ])
  // check coi phiên này có tồn tại với guest này trước đó không
  const tableSessions = await prisma.tableSession.findFirst({
    where: {
      id: guest.tableSessionId!
    }
  })
  if (tableSessions?.status !== 'Active') {
    await prisma.tableSession.update({
      where: {
        id: guest.tableSessionId!
      },
      data: {
        status: 'Active',
        guestCount: { increment: 1 },
        endTime: null,
        orderCount: { increment: ordersRecord.length }
      }
    })
  } else if (tableSessions?.status === 'Active') {
    await prisma.tableSession.update({
      where: {
        id: guest.tableSessionId!
      },
      data: {
        orderCount: { increment: ordersRecord.length }
      }
    })
  }

  return {
    orders: ordersRecord,
    socketId: socketRecord?.socketId
  }
}

export const getOrdersController = async ({ fromDate, toDate }: { fromDate?: Date; toDate?: Date }) => {
  const orders = await prisma.order.findMany({
    include: {
      dishSnapshot: true,
      orderHandler: true,
      guest: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    where: {
      createdAt: {
        gte: fromDate,
        lte: toDate
      }
    }
  })
  return orders
}

// Controller thanh toán các hóa đơn dựa trên tableNumber (thanh toán cả bàn)
export const payOrdersByTableController = async ({
  tableNumber,
  orderHandlerId
}: {
  tableNumber: number
  orderHandlerId: number
}) => {
  const orders = await prisma.order.findMany({
    where: {
      tableNumber,
      status: {
        in: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Delivered]
      }
    },
    include: {
      guest: true
    }
  })
  if (orders.length === 0) {
    throw new Error('Không có hóa đơn nào cần thanh toán cho bàn này')
  }

  await prisma.$transaction(async (tx) => {
    const orderIds = orders.map((order) => order.id)
    const updatedOrders = await tx.order.updateMany({
      where: {
        id: {
          in: orderIds
        }
      },
      data: {
        status: OrderStatus.Paid,
        orderHandlerId
      }
    })
    return updatedOrders
  })

  // Lấy tất cả socketId của các guest ở bàn này
  const guestIds = [...new Set(orders.map((order) => order.guestId).filter((id) => id !== null))] as number[]
  const [ordersResult, socketRecords] = await Promise.all([
    prisma.order.findMany({
      where: {
        id: {
          in: orders.map((order) => order.id)
        }
      },
      include: {
        dishSnapshot: true,
        orderHandler: true,
        guest: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.socket.findMany({
      where: {
        guestId: {
          in: guestIds
        }
      }
    })
  ])

  return {
    orders: ordersResult,
    socketIds: socketRecords.map((record) => record.socketId)
  }
}

export const getOrderDetailController = (orderId: number) => {
  return prisma.order.findUniqueOrThrow({
    where: {
      id: orderId
    },
    include: {
      dishSnapshot: true,
      orderHandler: true,
      guest: true,
      table: true
    }
  })
}

export const updateOrderController = async (
  orderId: number,
  body: UpdateOrderBodyType & { orderHandlerId: number }
) => {
  const { status, menuItemId, quantity, orderHandlerId } = body
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: {
        id: orderId
      },
      include: {
        dishSnapshot: true
      }
    })

    if (!order.dishSnapshot.menuItemId) {
      throw new Error('Không tìm thấy thông tin menuItem từ dishSnapshot')
    }

    // Không cho phép cập nhật order đã bị từ chối
    if (order.status === OrderStatus.Rejected) {
      throw new Error('Không thể cập nhật đơn hàng đã bị từ chối')
    }

    // Nếu món ăn từ "Pending" -> "Processing": Check nguyên liệu và tạo phiếu xuất kho
    if (order.status === OrderStatus.Pending && status === OrderStatus.Processing) {
      const menuItem = await tx.menuItem.findFirstOrThrow({
        where: { id: order.dishSnapshot.menuItemId },
        include: {
          dish: {
            include: {
              dishIngredients: {
                include: {
                  ingredient: true
                }
              }
            }
          }
        }
      })

      const dishIngredients = menuItem.dish.dishIngredients

      if (dishIngredients.length === 0) {
        // Món ăn không có nguyên liệu - bỏ qua xuất kho
        console.warn(`Món ${menuItem.dish.name} không có nguyên liệu`)
      } else {
        // 1. Tính tổng nguyên liệu cần xuất (quantity * số phần order)
        const ingredientUsage = new Map<number, { quantity: number; ingredientName: string; ingredientUnit: string }>()

        for (const di of dishIngredients) {
          const qtyPerDish = parseFloat(di.quantity || '0')
          if (qtyPerDish <= 0) continue

          const totalQty = qtyPerDish * order.quantity

          ingredientUsage.set(di.ingredientId, {
            quantity: totalQty,
            ingredientName: di.ingredient.name,
            ingredientUnit: di.ingredient.unit
          })
        }

        // 3. Tạo ExportReceipt
        const exportCode = await generateExportReceiptCode(tx)
        const exportReceipt = await tx.exportReceipt.create({
          data: {
            code: exportCode,
            exportType: 'Production', // Xuất để sản xuất món ăn
            status: 'Completed',
            relatedOrderId: order.id,
            createdBy: orderHandlerId,
            note: `Xuất kho cho Order #${order.id} - ${menuItem.dish.name} x${order.quantity}`,
            totalAmount: 0 // Sẽ cập nhật sau
          }
        })

        // 4. Xuất từng nguyên liệu theo FIFO
        let totalExportValue = 0

        for (const [ingredientId, usage] of ingredientUsage) {
          const result = await exportIngredientFIFO(tx, exportReceipt.id, ingredientId, usage.quantity)

          totalExportValue += result.totalValue
        }

        // 5. Cập nhật totalAmount cho ExportReceipt
        await tx.exportReceipt.update({
          where: { id: exportReceipt.id },
          data: { totalAmount: totalExportValue }
        })
      }
    }

    let dishSnapshotId = order.dishSnapshotId

    // Nếu thay đổi món ăn, tạo dishSnapshot mới từ menuItem
    if (menuItemId && order.dishSnapshot.menuItemId !== menuItemId) {
      const menuItem = await tx.menuItem.findUniqueOrThrow({
        where: {
          id: menuItemId
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

      const dishSnapshot = await tx.dishSnapshot.create({
        data: {
          description: dish.description,
          image: dish.image,
          name: dish.name,
          price: menuItem.price,
          menuItemId: menuItem.id,
          status: menuItem.status
        }
      })
      dishSnapshotId = dishSnapshot.id
    }

    const newOrder = await tx.order.update({
      where: {
        id: orderId
      },
      data: {
        status,
        dishSnapshotId,
        quantity,
        orderHandlerId
      },
      include: {
        dishSnapshot: true,
        orderHandler: true,
        guest: true
      }
    })
    return newOrder
  })
  const socketRecord = await prisma.socket.findUnique({
    where: {
      guestId: result.guestId!
    }
  })
  return {
    order: result,
    socketId: socketRecord?.socketId
  }
}

export const getCountOrderTodayController = async ({ fromDate, toDate }: { fromDate?: Date; toDate?: Date }) => {
  const guestCallList = await prisma.order.count({
    where: {
      status: {
        in: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Delivered]
      },
      createdAt: {
        gte: fromDate,
        lte: toDate
      }
    }
  })
  return guestCallList
}
