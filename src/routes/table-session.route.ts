import {
  getDetailHistoryTableSession,
  getListTableSessionActive,
  getTableSessionActive
} from '@/controllers/tableSession.controller'
import { requireEmployeeHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  TableSessionActiveListRes,
  TableSessionActiveListResType,
  TableSessionActiveRes,
  TableSessionActiveResType,
  TableSessionDetailRes,
  TableSessionDetailResType,
  TableSessionParamsType
} from '@/schemaValidations/tableSessions.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function tableSessionsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
      relation: 'and'
    })
  ),
    fastify.get<{
      Reply: TableSessionDetailResType
      Params: TableSessionParamsType
    }>(
      '/:id',
      {
        schema: {
          response: {
            200: TableSessionDetailRes
          }
        }
      },
      async (request, reply) => {
        const data = await getDetailHistoryTableSession({
          id: Number(request.params.id)
        })
        reply.send({
          data: data as TableSessionDetailResType['data'],
          message: 'Lấy chi tiết lịch sử phiên bàn thành công!'
        })
      }
    )

  // lấy danh sách phiên bản đang active của bàn
  fastify.get<{
    Reply: TableSessionActiveListResType
  }>(
    '/active-list',
    {
      schema: {
        response: {
          200: TableSessionActiveListRes
        }
      }
    },
    async (request, reply) => {
      const data = await getListTableSessionActive()

      reply.send({
        data: data as TableSessionActiveListResType['data'],
        message: data ? 'Lấy danh sách phiên bàn hiện tại thành công!' : `Không có phiên bàn nào đang hoạt động`
      })
    }
  )

  // lấy chi tiết phiên bản đang active của bàn
  fastify.get<{
    Reply: TableSessionActiveResType
    Params: TableSessionParamsType
  }>(
    '/:id/active',
    {
      schema: {
        response: {
          200: TableSessionActiveRes
        }
      }
    },
    async (request, reply) => {
      const data = await getTableSessionActive({
        id: Number(request.params.id)
      })

      reply.send({
        data: data as TableSessionActiveResType['data'],
        message: data
          ? 'Lấy chi tiết phiên bàn hiện tại thành công!'
          : `Bàn ${request.params.id} không có phiên hoạt động`
      })
    }
  )
}
