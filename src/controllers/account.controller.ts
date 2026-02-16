import envConfig from '@/config'
import { PrismaErrorCode } from '@/constants/error-reference'
import { Role, TableStatus } from '@/constants/type'
import prisma from '@/database'
import {
  AccountQueryType,
  ChangePasswordBodyType,
  CreateEmployeeAccountBodyType,
  CreateGuestBodyType,
  UpdateEmployeeAccountBodyType,
  UpdateMeBodyType
} from '@/schemaValidations/account.schema'
import { BaseQueryType } from '@/schemaValidations/util.schema'
import { RoleType } from '@/types/jwt.types'
import { comparePassword, hashPassword } from '@/utils/crypto'
import { EntityError, isPrismaClientKnownRequestError } from '@/utils/errors'
import { getChalk } from '@/utils/helpers'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt'

export const initOwnerAccount = async () => {
  const accountCount = await prisma.account.count()
  if (accountCount === 0) {
    const hashedPassword = await hashPassword(envConfig.INITIAL_PASSWORD_OWNER)
    await prisma.account.create({
      data: {
        name: 'Owner',
        email: envConfig.INITIAL_EMAIL_OWNER,
        password: hashedPassword,
        role: Role.Owner
      }
    })
    const chalk = await getChalk()
    console.log(
      chalk.bgCyan(
        `Khởi tạo tài khoản chủ quán thành công: ${envConfig.INITIAL_EMAIL_OWNER}|${envConfig.INITIAL_PASSWORD_OWNER}`
      )
    )
  }
}

export const createEmployeeAccount = async (body: CreateEmployeeAccountBodyType) => {
  try {
    const hashedPassword = await hashPassword(body.password)
    const account = await prisma.account.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: Role.Employee,
        avatar: body.avatar
      }
    })
    return account
  } catch (error: any) {
    if (isPrismaClientKnownRequestError(error)) {
      if (error.code === PrismaErrorCode.UniqueConstraintViolation) {
        throw new EntityError([{ field: 'email', message: 'Email đã tồn tại' }])
      }
    }
    throw error
  }
}

export const getEmployeeAccount = async (accountId: number) => {
  const account = await prisma.account.findUniqueOrThrow({
    where: {
      id: accountId
    }
  })
  return account
}

export const getAccountList = async ({ page, limit, email }: AccountQueryType) => {
  const skip = (page - 1) * limit
  // Tạo whereCondition dùng chung
  const whereCondition = email ? { email: { contains: email } } : {}

  const [accounts, total] = await Promise.all([
    prisma.account.findMany({
      skip,
      take: limit,
      orderBy: { id: 'desc' },
      where: whereCondition // ← Dùng chung
    }),
    prisma.account.count({
      where: whereCondition // ← Đếm theo điều kiện
    })
  ])

  return {
    data: accounts, // Trả về trực tiếp, không cần map
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

export const updateEmployeeAccount = async (accountId: number, body: UpdateEmployeeAccountBodyType) => {
  try {
    const [socketRecord, oldAccount] = await Promise.all([
      prisma.socket.findUnique({
        where: {
          accountId
        }
      }),
      prisma.account.findUnique({
        where: {
          id: accountId
        }
      })
    ])
    if (!oldAccount) {
      throw new EntityError([{ field: 'email', message: 'Tài khoản bạn đang cập nhật không còn tồn tại nữa!' }])
    }
    const isChangeRole = oldAccount.role !== body.role
    if (body.changePassword) {
      const hashedPassword = await hashPassword(body.password!)
      const account = await prisma.account.update({
        where: {
          id: accountId
        },
        data: {
          name: body.name,
          email: body.email,
          avatar: body.avatar,
          password: hashedPassword,
          role: body.role
        }
      })
      return {
        account,
        socketId: socketRecord?.socketId,
        isChangeRole
      }
    } else {
      const account = await prisma.account.update({
        where: {
          id: accountId
        },
        data: {
          name: body.name,
          email: body.email,
          avatar: body.avatar,
          role: body.role
        }
      })
      return {
        account,
        socketId: socketRecord?.socketId,
        isChangeRole
      }
    }
  } catch (error: any) {
    if (isPrismaClientKnownRequestError(error)) {
      if (error.code === PrismaErrorCode.UniqueConstraintViolation) {
        throw new EntityError([{ field: 'email', message: 'Email đã tồn tại' }])
      }
    }
    throw error
  }
}

export const deleteEmployeeAccount = async (accountId: number) => {
  const socketRecord = await prisma.socket.findUnique({
    where: {
      accountId
    }
  })
  const account = await prisma.account.delete({
    where: {
      id: accountId
    }
  })
  return {
    account,
    socketId: socketRecord?.socketId
  }
}

export const getMeController = async (accountId: number) => {
  const account = prisma.account.findUniqueOrThrow({
    where: {
      id: accountId
    }
  })
  return account
}

export const updateMeController = async (accountId: number, body: UpdateMeBodyType) => {
  const account = prisma.account.update({
    where: {
      id: accountId
    },
    data: body
  })
  return account
}

export const changePasswordController = async (accountId: number, body: ChangePasswordBodyType) => {
  const account = await prisma.account.findUniqueOrThrow({
    where: {
      id: accountId
    }
  })
  const isSame = await comparePassword(body.oldPassword, account.password)
  if (!isSame) {
    throw new EntityError([{ field: 'oldPassword', message: 'Mật khẩu cũ không đúng' }])
  }
  const hashedPassword = await hashPassword(body.password)
  const newAccount = await prisma.account.update({
    where: {
      id: accountId
    },
    data: {
      password: hashedPassword
    }
  })
  return newAccount
}

export const changePasswordV2Controller = async (accountId: number, body: ChangePasswordBodyType) => {
  const account = await changePasswordController(accountId, body)
  await prisma.refreshToken.deleteMany({
    where: {
      accountId
    }
  })
  const accessToken = signAccessToken({
    userId: account.id,
    role: account.role as RoleType
  })
  const refreshToken = signRefreshToken({
    userId: account.id,
    role: account.role as RoleType
  })
  const decodedRefreshToken = verifyRefreshToken(refreshToken)
  const refreshTokenExpiresAt = new Date(decodedRefreshToken.exp * 1000)
  await prisma.refreshToken.create({
    data: {
      accountId: account.id,
      token: refreshToken,
      expiresAt: refreshTokenExpiresAt
    }
  })
  return {
    account,
    accessToken,
    refreshToken
  }
}

export const getGuestList = async ({ fromDate, toDate }: { fromDate?: Date; toDate?: Date }) => {
  const orders = await prisma.guest.findMany({
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

export const createGuestController = async (body: CreateGuestBodyType) => {
  const table = await prisma.table.findUnique({
    where: {
      number: body.tableNumber
    }
  })
  if (!table) {
    throw new Error('Bàn không tồn tại')
  }

  if (table.status === TableStatus.Hidden) {
    throw new Error(`Bàn ${table.number} đã bị ẩn, vui lòng chọn bàn khác`)
  }

  if (table.status === TableStatus.Available) {
    await prisma.table.update({
      where: { number: body.tableNumber },
      data: { status: TableStatus.Serving }
    })
  }

  // check coi có phiên nào thuộc bàn đó đang mở không, nếu có thì cho khách vào phiên đó, không thì tạo phiên mới rồi cho khách vào
  const activeSession = await prisma.tableSession.findFirst({
    where: {
      tableNumber: body.tableNumber,
      status: 'Active'
    }
  })
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

  const guest = await prisma.guest.create({
    data: {
      ...body,
      tableSessionId: sessionId
    }
  })
  return guest
}
