import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { createPayment, getPayments, getDetailPayment, createPaymentForTable } from '@/controllers/payment.controller'
import {
  CreatePaymentBody,
  CreatePaymentBodyType,
  CreatePaymentByTableBody,
  CreatePaymentByTableBodyType,
  CreatePaymentRes,
  CreatePaymentResType,
  CreatePaymentTableRes,
  CreatePaymentTableResType,
  GetPaymentsQuery,
  GetPaymentsQueryType,
  PaymentIdParam,
  PaymentIdParamType,
  PaymentListRes,
  PaymentListResType,
  PaymentRes,
  PaymentResType
} from '@/schemaValidations/payment.schema'
import { requireEmployeeHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import { ManagerRoom } from '@/constants/type'

export default async function paymentRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Global auth cho tất cả routes (trừ webhook)
  fastify.addHook('preValidation', fastify.auth([requireLoginedHook]))

  // POST /payments - Tạo payment mới theo guestId (trả tiền theo khách)
  fastify.post<{
    Body: CreatePaymentBodyType
    Reply: CreatePaymentResType
  }>(
    '/',
    {
      schema: {
        response: {
          200: CreatePaymentRes
        },
        body: CreatePaymentBody
      },
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const accountId = request.decodedAccessToken?.userId as number
      const { responseData, socketId, orders } = await createPayment(request.body, accountId, fastify.io)
      if (socketId && request.body.paymentMethod === 'CASH') {
        fastify.io.to(socketId).to(ManagerRoom).emit('payment', orders)
      } else {
        fastify.io.to(ManagerRoom).emit('payment', orders)
      }

      if (request.body.paymentMethod === 'CASH') {
        fastify.io.to(ManagerRoom).emit('count-order') // vì tiền mặt thì payments sẽ được duyệt ngay (paid) và các order sẽ là paid nên là bắn socket về cập nhật count-order
      }
      // còn SeePay thì phải đợi webhook từ SeePay về mới đổi trạng thái payment và order nên chưa cần bắn socket

      reply.status(201).send({
        message: 'Tạo payment thành công',
        data: responseData as CreatePaymentResType['data']
      })
    }
  )

  // POST /payments/table - Tạo payment mới trả cho các bản (Nếu bàn đó có nhiều khách thì sẽ trả cho tất cả khách)
  fastify.post<{
    Body: CreatePaymentByTableBodyType
    Reply: CreatePaymentTableResType
  }>(
    '/table',
    {
      schema: {
        response: {
          200: CreatePaymentTableRes
        },
        body: CreatePaymentByTableBody
      },
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const accountId = request.decodedAccessToken?.userId as number
      const result = await createPaymentForTable(request.body, accountId)

      // Emit socket events to all guests' sockets
      const { socketIds, orders } = result
      if (socketIds && socketIds.length > 0 && request.body.paymentMethod === 'CASH') {
        socketIds.forEach((socketId: string) => {
          fastify.io.to(socketId).emit('payment', orders)
        })
      }
      // Luôn emit to ManagerRoom
      fastify.io.to(ManagerRoom).emit('payment', orders)

      if (request.body.paymentMethod === 'CASH') {
        fastify.io.to(ManagerRoom).emit('count-order') // vì tiền mặt thì payments sẽ được duyệt ngay (paid) và các order sẽ là paid nên là bắn socket về cập nhật count-order
      }
      // còn SeePay thì phải đợi webhook từ SeePay về mới đổi trạng thái payment và order nên chưa cần bắn socket

      reply.status(201).send({
        message: 'Tạo payment thành công',
        data: result as CreatePaymentTableResType['data']
      })
    }
  )

  // GET /payments - Danh sách payments
  fastify.get<{
    Reply: PaymentListResType
    Querystring: GetPaymentsQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: PaymentListRes
        },
        querystring: GetPaymentsQuery
      },
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const result = await getPayments(request.query)
      reply.send(result as PaymentListResType)
    }
  )

  // GET /api/payments/:id - Kiểm tra trạng thái
  fastify.get<{
    Reply: PaymentResType
    Params: PaymentIdParamType
  }>(
    '/:id',
    {
      schema: {
        response: {
          200: PaymentRes
        },
        params: PaymentIdParam
      },
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const payment = await getDetailPayment(request.params.id)
      reply.send({
        data: payment as PaymentResType['data']
      })
    }
  )
}
