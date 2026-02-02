import { GuestCallStatusType, ManagerRoom } from '@/constants/type'
import {
  getCountGuestCallPendingController,
  getGuestCallsController,
  updateGuestCall
} from '@/controllers/guest-call.controller'
import { requireEmployeeHook, requireGuestHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import { DishParamsType } from '@/schemaValidations/dish.schema'
import {
  GuestCallListRes,
  GuestCallListResType,
  GuestCallCountRes,
  GuestCallCountResType,
  GuestCallResType,
  GuestCallRes
} from '@/schemaValidations/guest-call.schema'
import { GetOrdersQueryParams, GetOrdersQueryParamsType } from '@/schemaValidations/order.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function guestCallRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook, requireGuestHook]], {
      relation: 'and'
    })
  ),
    fastify.get<{ Reply: GuestCallListResType; Querystring: GetOrdersQueryParamsType }>(
      '/',
      {
        schema: {
          response: {
            200: GuestCallListRes
          },
          querystring: GetOrdersQueryParams
        }
      },
      async (request, reply) => {
        const result = await getGuestCallsController({
          fromDate: request.query.fromDate,
          toDate: request.query.toDate
        })
        reply.send({
          message: 'Lấy danh sách khách gọi phục vụ thành công',
          data: result as GuestCallListResType['data']
        })
      }
    ),
    fastify.put<{
      Reply: GuestCallResType
      Params: DishParamsType
      Body: { status: GuestCallStatusType }
    }>(
      '/:id',
      {
        schema: {
          response: {
            200: GuestCallRes
          },
          querystring: GetOrdersQueryParams
        }
      },
      async (request, reply) => {
        const result = await updateGuestCall({
          idGuestCall: request.params.id,
          status: request.body.status,
          accountRecipient: request.decodedAccessToken?.userId as number
        })
        fastify.io.to(ManagerRoom).emit('count-call-waiter', result)
        reply.send({
          message: 'Cập nhật khách gọi phục vụ thành công!',
          data: result as GuestCallResType['data']
        })
      }
    ),
    fastify.get<{
      Reply: GuestCallCountResType
      Querystring: GetOrdersQueryParamsType
    }>(
      '/count-pending',
      {
        schema: {
          response: {
            200: GuestCallCountRes
          },
          querystring: GetOrdersQueryParams
        }
      },
      async (request, reply) => {
        const result = await getCountGuestCallPendingController({
          fromDate: request.query.fromDate,
          toDate: request.query.toDate
        })
        reply.send({
          message: 'Lấy số lượng khách gọi phục vụ đang chờ thành công',
          data: result
        })
      }
    )
}
