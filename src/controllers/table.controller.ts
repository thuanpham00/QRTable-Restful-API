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

export const deleteTable = (number: number) => {
  return prisma.table.delete({
    where: {
      number
    }
  })
}
