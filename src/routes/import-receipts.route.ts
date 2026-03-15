import {
  createImportReceipt,
  getImportReceiptDetail,
  getImportReceiptList,
  updateImportReceipt
} from '@/controllers/import-receipt.controller'
import { pauseApiHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  CreateImportReceiptBody,
  CreateImportReceiptBodyType,
  CreateImportReceiptRes,
  CreateImportReceiptResType,
  GetImportReceiptDetailRes,
  GetImportReceiptDetailResType,
  GetImportReceiptListRes,
  GetImportReceiptListResType,
  ImportReceiptParams,
  ImportReceiptParamsType,
  ImportReceiptQuery,
  ImportReceiptQueryType,
  UpdateImportReceiptBody,
  UpdateImportReceiptBodyType,
  UpdateImportReceiptRes,
  UpdateImportReceiptResType
} from '@/schemaValidations/import-receipt.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function importReceiptRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook]], {
      relation: 'and'
    })
  )

  // GET /import-receipts - Lấy danh sách phiếu nhập kho
  fastify.get<{
    Reply: GetImportReceiptListResType
    Querystring: ImportReceiptQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: GetImportReceiptListRes
        },
        querystring: ImportReceiptQuery
      }
    },
    async (request, reply) => {
      const { data, pagination } = await getImportReceiptList({
        page: request.query.page || 1,
        limit: request.query.limit || 10,
        supplierId: request.query.supplierId,
        status: request.query.status,
        fromDate: request.query.fromDate,
        toDate: request.query.toDate
      })

      reply.status(200).send({
        data: data as GetImportReceiptListResType['data'],
        pagination,
        message: 'Lấy danh sách phiếu nhập kho thành công'
      })
    }
  )

  // GET /import-receipts/:id - Lấy chi tiết phiếu nhập kho
  fastify.get<{
    Reply: GetImportReceiptDetailResType
    Params: ImportReceiptParamsType
  }>(
    '/:id',
    {
      schema: {
        response: {
          200: GetImportReceiptDetailRes
        },
        params: ImportReceiptParams
      }
    },
    async (request, reply) => {
      const data = await getImportReceiptDetail(request.params.id)

      if (!data) {
        return reply.status(404).send({
          data: null as any,
          message: 'Không tìm thấy phiếu nhập kho'
        })
      }

      reply.status(200).send({
        data: data as GetImportReceiptDetailResType['data'],
        message: 'Lấy chi tiết phiếu nhập kho thành công'
      })
    }
  )

  // POST /import-receipts - Tạo phiếu nhập kho mới
  fastify.post<{
    Reply: CreateImportReceiptResType
    Body: CreateImportReceiptBodyType
  }>(
    '/',
    {
      schema: {
        response: {
          201: CreateImportReceiptRes
        },
        body: CreateImportReceiptBody
      }
    },
    async (request, reply) => {
      const accountId = request.decodedAccessToken?.userId as number

      const data = await createImportReceipt(request.body, accountId)

      reply.status(201).send({
        data: data as CreateImportReceiptResType['data'],
        message: 'Tạo phiếu nhập kho thành công'
      })
    }
  )

  // PUT /import-receipts/:id - Cập nhật phiếu nhập kho
  fastify.put<{
    Reply: UpdateImportReceiptResType
    Params: ImportReceiptParamsType
    Body: UpdateImportReceiptBodyType
  }>(
    '/:id',
    {
      schema: {
        response: {
          200: UpdateImportReceiptRes
        },
        params: ImportReceiptParams,
        body: UpdateImportReceiptBody
      }
    },
    async (request, reply) => {
      try {
        const data = await updateImportReceipt(request.params.id, request.body, fastify)

        reply.status(200).send({
          data: data as UpdateImportReceiptResType['data'],
          message: 'Cập nhật phiếu nhập kho thành công'
        })
      } catch (error: any) {
        return reply.status(400).send({
          data: null as any,
          message: error.message || 'Lỗi khi cập nhật phiếu nhập kho'
        })
      }
    }
  )
}
