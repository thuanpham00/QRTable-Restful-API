import { getExportReceiptDetail, getExportReceiptList } from '@/controllers/export-receipt.controller'
import { pauseApiHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  ExportReceiptListRes,
  ExportReceiptListResType,
  ExportReceiptParams,
  ExportReceiptParamsType,
  ExportReceiptQuery,
  ExportReceiptQueryType,
  ExportReceiptRes,
  ExportReceiptResType
} from '@/schemaValidations/export-receipt.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function exportReceiptRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook]], {
      relation: 'and'
    })
  )

  // GET /export-receipts - Lấy danh sách phiếu xuất kho
  fastify.get<{
    Reply: ExportReceiptListResType
    Querystring: ExportReceiptQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: ExportReceiptListRes
        },
        querystring: ExportReceiptQuery
      }
    },
    async (request, reply) => {
      const { data, pagination } = await getExportReceiptList({
        page: request.query.page || 1,
        limit: request.query.limit || 10,
        fromDate: request.query.fromDate,
        toDate: request.query.toDate
      })

      reply.status(200).send({
        data: data as ExportReceiptListResType['data'],
        pagination,
        message: 'Lấy danh sách phiếu xuất kho thành công'
      })
    }
  )

  // GET /export-receipts/:id - Lấy chi tiết phiếu xuất kho
  fastify.get<{
    Reply: ExportReceiptResType
    Params: ExportReceiptParamsType
  }>(
    '/:id',
    {
      schema: {
        response: {
          200: ExportReceiptRes
        },
        params: ExportReceiptParams
      }
    },
    async (request, reply) => {
      const data = await getExportReceiptDetail(request.params.id)

      reply.status(200).send({
        data: data as ExportReceiptResType['data'],
        message: 'Lấy chi tiết phiếu xuất kho thành công'
      })
    }
  )
}
