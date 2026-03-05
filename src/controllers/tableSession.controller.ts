import { OrderStatus, TableStatus } from '@/constants/type'
import prisma from '@/database'

export const getListHistoryTableSession = async (query: { number: number }) => {
  const tableSessions = await prisma.tableSession.findMany({
    where: {
      tableNumber: query.number,
      status: {
        in: ['Cancelled', 'Completed']
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      orders: {
        include: {
          dishSnapshot: true
        }
      },
      guests: true,
      paymentGroups: true
    }
  })

  return tableSessions
}

export const getTableSessionActive = async (query: { id: number }) => {
  const tableSessions = await prisma.tableSession.findFirst({
    where: {
      tableNumber: query.id,
      status: 'Active'
    }
  })
  // phải check thêm toàn bộ order của phiên này đã hoàn thành hoặc từ chối
  if (tableSessions) {
    const listOrder = await prisma.order.findMany({
      where: {
        tableSessionId: tableSessions.id,
        status: { in: [OrderStatus.Paid, OrderStatus.Rejected] }
      }
    })
    if (listOrder.length === tableSessions.orderCount) {
      return {
        ...tableSessions,
        dishesBeenServed: true
      }
    } else {
      return { ...tableSessions, dishesBeenServed: false }
    }
  }
  return tableSessions
}

export const getListTableSessionActive = async () => {
  // lấy danh sách bàn có trạng thái Serving -> lấy danh sách session active của những bàn này
  const tables = await prisma.table.findMany({
    where: {
      status: TableStatus.Serving
    }
  })

  const listTableId = tables.map((table) => table.number)

  const tableSessions = await prisma.tableSession.findMany({
    where: {
      tableNumber: { in: listTableId },
      status: 'Active'
    }
  })

  return tableSessions
}

export const getDetailHistoryTableSession = async (query: { id: number }) => {
  const tableSession = await prisma.tableSession.findUniqueOrThrow({
    where: {
      id: query.id
    },
    include: {
      orders: {
        include: {
          dishSnapshot: true
        }
      },
      guests: true,
      paymentGroups: {
        include: {
          payments: {
            include: {
              guest: { select: { id: true, name: true } },
              orders: {
                include: { dishSnapshot: true }
              }
            }
          },
          createdBy: { select: { id: true, name: true } }
        }
      }
    }
  })

  const listGuestId = tableSession.guests.map((guest) => guest.id)

  const individualPayments = await prisma.payment.findMany({
    where: {
      guestId: { in: listGuestId },
      paymentGroupId: null
    },
    include: {
      guest: { select: { id: true, name: true } },
      orders: {
        where: { tableSessionId: query.id },
        include: { dishSnapshot: true }
      },
      createdBy: { select: { id: true, name: true } }
    }
  })
  // Case 2: vừa có thanh toán nhóm vừa có thanh toán lẻ (thanh toán nhiều lần trong 1 phiên)
  if (tableSession.paymentGroups.length > 0 && individualPayments.length > 0) {
    return {
      ...tableSession,
      paymentType: 'group' as const,
      individualPayments
    }
  }

  // Case 1: chỉ có thanh toán nhóm
  if (tableSession.paymentGroups.length > 0) {
    return {
      ...tableSession,
      paymentType: 'group' as const,
      individualPayments: []
    }
  }

  // Case 3: chỉ có thanh toán lẻ
  return {
    ...tableSession,
    paymentType: 'individual' as const,
    paymentGroups: [],
    individualPayments
  }
}
