import { GuestCallStatus, ManagerRoom, Role } from '@/constants/type'
import prisma from '@/database'
import { AuthError } from '@/utils/errors'
import { getChalk } from '@/utils/helpers'
import { verifyAccessToken } from '@/utils/jwt'
import fastifyPlugin from 'fastify-plugin'

export const socketPlugin = fastifyPlugin(async (fastify) => {
  const chalk = await getChalk()
  fastify.io.use(async (socket, next) => {
    const { Authorization } = socket.handshake.auth

    if (!Authorization) {
      return next(new AuthError('Authorization không hợp lệ'))
    }
    const accessToken = Authorization.split(' ')[1]
    try {
      const decodedAccessToken = verifyAccessToken(accessToken)
      const { userId, role } = decodedAccessToken
      if (role === Role.Guest) {
        await prisma.socket.upsert({
          where: {
            guestId: userId
          },
          update: {
            socketId: socket.id
          },
          create: {
            guestId: userId,
            socketId: socket.id
          }
        })
      } else {
        await prisma.socket.upsert({
          where: {
            accountId: userId
          },
          update: {
            socketId: socket.id
          },
          create: {
            accountId: userId,
            socketId: socket.id
          }
        })
        socket.join(ManagerRoom)
      }
      socket.handshake.auth.decodedAccessToken = decodedAccessToken
    } catch (error: any) {
      return next(error)
    }
    next()
  })
  fastify.io.on('connection', async (socket) => {
    console.log(chalk.cyanBright('🔌 Socket connected:', socket.id))
    socket.on('disconnect', async (reason) => {
      console.log(chalk.redBright('🔌 Socket disconnected:', socket.id))
    })

    socket.on('guest:call-waiter', async (data: { tableNumber: string; idGuest: string }) => {
      await prisma.guestCall.create({
        data: {
          tableNumber: Number(data.tableNumber),
          status: GuestCallStatus.Pending,
          accountId: null,
          guestId: socket.handshake.auth.decodedAccessToken.userId
        }
      })
      const countGuestCallPending = await prisma.guestCall.count({
        where: {
          status: GuestCallStatus.Pending
        }
      })
      fastify.io.to(ManagerRoom).emit('count-call-waiter', {
        message: 'Khách gọi phục vụ',
        countPending: countGuestCallPending
      })
    })
  })
})
