import { ManagerRoom, TableStatus } from '@/constants/type'
import prisma from '@/database'
import { CreateTableBodyType, TableQueryType, UpdateTableBodyType } from '@/schemaValidations/table.schema'
import { EntityError, isPrismaClientKnownRequestError } from '@/utils/errors'
import { randomId } from '@/utils/helpers'

export const getTableList = async ({ page, limit, number, pagination }: TableQueryType) => {
  if (pagination === 'false') {
    const tables = await prisma.table.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return {
      data: tables,
      pagination: null
    }
  }

  const skip = (page - 1) * limit

  // ✅ Lấy tất cả tables, filter trong memory
  const allTables =
    number !== undefined
      ? await prisma.table.findMany({
          orderBy: { createdAt: 'desc' }
        })
      : null

  if (allTables && number !== undefined) {
    // Filter trong JS - tìm số có chứa number
    const filtered = allTables.filter((table) => table.number.toString().includes(number.toString()))

    const total = filtered.length
    const paginatedTables = filtered.slice(skip, skip + limit)

    return {
      data: paginatedTables,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Không có filter - query bình thường
  const [tables, total] = await Promise.all([
    prisma.table.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.table.count()
  ])

  return {
    data: tables,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }
}

export const getTableDetail = (number: number) => {
  return prisma.table.findUniqueOrThrow({
    where: {
      number
    }
  })
}

export const createTable = async (data: CreateTableBodyType) => {
  const token = randomId()
  try {
    const result = await prisma.table.create({
      data: {
        ...data,
        token
      }
    })
    return result
  } catch (error) {
    if (isPrismaClientKnownRequestError(error) && error.code === 'P2002') {
      throw new EntityError([
        {
          message: 'Số bàn này đã tồn tại',
          field: 'number'
        }
      ])
    }
    throw error
  }
}

export const updateTable = (number: number, data: UpdateTableBodyType) => {
  if (data.changeToken) {
    const token = randomId()
    // Xóa hết các refresh token của guest theo table
    return prisma.$transaction(async (tx) => {
      const [table] = await Promise.all([
        tx.table.update({
          where: {
            number
          },
          data: {
            status: data.status,
            capacity: data.capacity,
            notes: data.notes,
            typeQR: data.typeQR,
            token
          }
        }),
        tx.guest.updateMany({
          where: {
            tableNumber: number
          },
          data: {
            refreshToken: null,
            refreshTokenExpiresAt: null
          }
        })
      ])
      return table
    })
  }
  return prisma.table.update({
    where: {
      number
    },
    data: {
      status: data.status,
      capacity: data.capacity,
      notes: data.notes,
      typeQR: data.typeQR
    }
  })
}

export const deleteTable = async (number: number) => {
  const findTable = await prisma.table.findUnique({
    where: {
      number
    }
  })
  const activeSession = await prisma.tableSession.findFirst({
    where: {
      tableNumber: number,
      status: 'Active'
    }
  })
  if (findTable?.status === TableStatus.Serving) {
    throw new Error(`Bàn ${number} đang phục vụ, không thể xóa`)
  }
  if (activeSession) {
    throw new Error(`Bàn ${number} đang có phiên hoạt động, không thể xóa`)
  }
  return prisma.table.delete({
    where: {
      number
    }
  })
}

export const cleanTableController = async ({
  tableNumber,
  accountId,
  io
}: {
  tableNumber: number
  accountId: number
  io: any
}) => {
  // 1. Tìm session Active của bàn
  const activeSession = await prisma.tableSession.findFirst({
    where: {
      tableNumber,
      status: 'Active'
    },
    include: {
      guests: {
        where: {
          refreshToken: { not: null } // Chỉ lấy guests đang login
        }
      }
    }
  })

  if (!activeSession) {
    throw new Error('Bàn này không có phiên nào đang hoạt động')
  }

  // 2. Check có orders chưa thanh toán không
  const unpaidOrders = await prisma.order.count({
    where: {
      tableSessionId: activeSession.id,
      status: { notIn: ['Paid', 'Rejected'] }
    }
  })

  if (unpaidOrders > 0) {
    throw new Error('Bàn này còn món chưa thanh toán, không thể dọn bàn')
  }

  // 3. Logout tất cả guests + End session + Set table Available
  await prisma.$transaction(async (tx) => {
    // Logout tất cả guests
    for (const guest of activeSession.guests) {
      await tx.guest.update({
        where: { id: guest.id },
        data: {
          refreshToken: null,
          refreshTokenExpiresAt: null
        }
      })
    }

    // End session
    await tx.tableSession.update({
      where: { id: activeSession.id },
      data: {
        status: 'Completed',
        endTime: new Date(),
        guestCount: 0,
        note: `Dọn bàn bởi nhân viên #${accountId}`
      }
    })

    // Set table Available
    await tx.table.update({
      where: { number: tableNumber },
      data: {
        status: TableStatus.Available
      }
    })
  })

  // 4. Emit socket để disconnect clients
  if (io) {
    const socketRecords = await prisma.socket.findMany({
      where: {
        guestId: { in: activeSession.guests.map((g) => g.id) }
      }
    })

    for (const socket of socketRecords) {
      io.to(socket.socketId).emit('force-logout', {
        reason: 'Bàn đã được dọn bởi nhân viên',
        tableNumber
      })
    }

    io.to(ManagerRoom).emit('table-cleaned', {
      tableNumber,
      sessionId: activeSession.id,
      cleanedBy: accountId,
      guestCount: activeSession.guests.length
    })
  }

  return {
    sessionId: activeSession.id,
    guestsLoggedOut: activeSession.guests.length,
    tableNumber
  }
}
