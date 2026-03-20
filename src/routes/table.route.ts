import {
  cleanTableController,
  createTable,
  deleteTable,
  getTableDetail,
  getTableList,
  updateTable
} from '@/controllers/table.controller'
import { getListHistoryTableSession } from '@/controllers/tableSession.controller'
import { requireEmployeeHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  CleanTableBody,
  CleanTableBodyType,
  CleanTableRes,
  CleanTableResType,
  CreateTableBody,
  CreateTableBodyType,
  TableListRes,
  TableListResType,
  TableParams,
  TableParamsType,
  TableQuery,
  TableQueryType,
  TableRes,
  TableResType,
  UpdateTableBody,
  UpdateTableBodyType
} from '@/schemaValidations/table.schema'
import {
  TableSessionListRes,
  TableSessionListResType,
  TableSessionParamsType
} from '@/schemaValidations/tableSessions.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function tablesRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get<{
    Reply: TableListResType
    Querystring: TableQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: TableListRes
        },
        querystring: TableQuery
      }
    },
    async (request, reply) => {
      const { data, pagination } = await getTableList({
        page: request.query.page || 1,
        limit: request.query.limit || 5,
        number: request.query.number,
        status: request.query.status,
        pagination: request.query.pagination
      })
      reply.send({
        data: data as TableListResType['data'],
        pagination: pagination || null,
        message: 'Lấy danh sách bàn thành công!'
      })
    }
  )

  fastify.get<{
    Params: TableParamsType
    Reply: TableResType
  }>(
    '/:number',
    {
      schema: {
        params: TableParams,
        response: {
          200: TableRes
        }
      }
    },
    async (request, reply) => {
      const Table = await getTableDetail(request.params.number)
      reply.send({
        data: Table as TableResType['data'],
        message: 'Lấy thông tin bàn thành công!'
      })
    }
  )

  fastify.post<{
    Body: CreateTableBodyType
    Reply: TableResType
  }>(
    '',
    {
      schema: {
        body: CreateTableBody,
        response: {
          200: TableRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const Table = await createTable(request.body)
      reply.send({
        data: Table as TableResType['data'],
        message: 'Tạo bàn thành công!'
      })
    }
  )

  fastify.put<{
    Params: TableParamsType
    Body: UpdateTableBodyType
    Reply: TableResType
  }>(
    '/:number',
    {
      schema: {
        params: TableParams,
        body: UpdateTableBody,
        response: {
          200: TableRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const Table = await updateTable(request.params.number, request.body)
      reply.send({
        data: Table as TableResType['data'],
        message: 'Cập nhật bàn thành công!'
      })
    }
  )

  fastify.delete<{
    Params: TableParamsType
    Reply: TableResType
  }>(
    '/:number',
    {
      schema: {
        params: TableParams,
        response: {
          200: TableRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const result = await deleteTable(request.params.number)
      reply.send({
        message: 'Xóa bàn thành công!',
        data: result as TableResType['data']
      })
    }
  )

  fastify.get<{
    Reply: TableSessionListResType
    Params: TableSessionParamsType
  }>(
    '/:id/sessions',
    {
      schema: {
        response: {
          200: TableSessionListRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const data = await getListHistoryTableSession({
        number: Number(request.params.id)
      })
      reply.send({
        data: data as TableSessionListResType['data'],
        message: 'Lấy danh sách lịch sử phiên bàn thành công!'
      })
    }
  )

  fastify.post<{
    Reply: CleanTableResType
    Body: CleanTableBodyType
  }>(
    '/clean',
    {
      schema: {
        body: CleanTableBody,
        response: {
          200: CleanTableRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const data = await cleanTableController({
        tableNumber: request.body.tableNumber,
        accountId: request.decodedAccessToken?.userId as number,
        io: fastify.io
      })
      reply.send({
        data: data as CleanTableResType['data'],
        message: 'Dọn bàn thành công!'
      })
    }
  )
}
