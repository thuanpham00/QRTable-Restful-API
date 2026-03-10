import {
  createInventoryStock,
  deleteInventoryStock,
  getInventoryStockDetail,
  getInventoryStockList,
  updateInventoryStock
} from '@/controllers/inventory-stock.controller'
import { pauseApiHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  CreateInventoryStockBody,
  CreateInventoryStockBodyType,
  InventoryStockListRes,
  InventoryStockListResType,
  InventoryStockParams,
  InventoryStockParamsType,
  InventoryStockQuery,
  InventoryStockQueryType,
  InventoryStockRes,
  InventoryStockResType,
  UpdateInventoryStockBody,
  UpdateInventoryStockBodyType
} from '@/schemaValidations/inventory-stock.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function inventoryStockRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook]], {
      relation: 'and'
    })
  )

  // GET /inventory-stocks - Lấy danh sách tồn kho
  fastify.get<{
    Reply: InventoryStockListResType
    Querystring: InventoryStockQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: InventoryStockListRes
        },
        querystring: InventoryStockQuery
      }
    },
    async (request, reply) => {
      const { data, pagination } = await getInventoryStockList({
        page: request.query.page || 1,
        limit: request.query.limit || 10,
        ingredientName: request.query.ingredientName,
        lowStock: request.query.lowStock
      })
      reply.send({
        data: data as InventoryStockListResType['data'],
        pagination: pagination,
        message: 'Lấy danh sách tồn kho thành công!'
      })
    }
  )

  // GET /inventory-stocks/:id - Lấy chi tiết tồn kho
  fastify.get<{
    Params: InventoryStockParamsType
    Reply: InventoryStockResType
  }>(
    '/:id',
    {
      schema: {
        params: InventoryStockParams,
        response: {
          200: InventoryStockRes
        }
      }
    },
    async (request, reply) => {
      const stock = await getInventoryStockDetail(request.params.id)
      reply.send({
        data: stock as InventoryStockResType['data'],
        message: 'Lấy thông tin tồn kho thành công!'
      })
    }
  )

  // POST /inventory-stocks - Tạo tồn kho mới
  fastify.post<{
    Body: CreateInventoryStockBodyType
    Reply: InventoryStockResType
  }>(
    '/',
    {
      schema: {
        body: CreateInventoryStockBody,
        response: {
          200: InventoryStockRes
        }
      }
    },
    async (request, reply) => {
      const stock = await createInventoryStock(request.body)
      reply.send({
        data: stock as InventoryStockResType['data'],
        message: 'Tạo tồn kho thành công!'
      })
    }
  )

  // PUT /inventory-stocks/:id - Cập nhật tồn kho
  fastify.put<{
    Params: InventoryStockParamsType
    Body: UpdateInventoryStockBodyType
    Reply: InventoryStockResType
  }>(
    '/:id',
    {
      schema: {
        params: InventoryStockParams,
        body: UpdateInventoryStockBody,
        response: {
          200: InventoryStockRes
        }
      }
    },
    async (request, reply) => {
      const stock = await updateInventoryStock(request.params.id, request.body)
      reply.send({
        data: stock as InventoryStockResType['data'],
        message: 'Cập nhật tồn kho thành công!'
      })
    }
  )

  // DELETE /inventory-stocks/:id - Xóa tồn kho
  fastify.delete<{
    Params: InventoryStockParamsType
    Reply: InventoryStockResType
  }>(
    '/:id',
    {
      schema: {
        params: InventoryStockParams,
        response: {
          200: InventoryStockRes
        }
      }
    },
    async (request, reply) => {
      const result = await deleteInventoryStock(request.params.id)
      reply.send({
        message: 'Xóa tồn kho thành công!',
        data: result as InventoryStockResType['data']
      })
    }
  )
}
