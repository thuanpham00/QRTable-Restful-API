import { getListInventoryBatchesByStockId } from '@/controllers/inventory-batch.controller'
import { pauseApiHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  InventoryBatchListRes,
  InventoryBatchListResType,
  InventoryBatchParams,
  InventoryBatchParamsType
} from '@/schemaValidations/inventory-batch.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function inventoryBatchRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook]], {
      relation: 'and'
    })
  )

  // GET /inventory-batches/:id - Lấy danh sách lô hàng của một inventoryStock
  fastify.get<{
    Reply: InventoryBatchListResType
    Params: InventoryBatchParamsType
  }>(
    '/:id',
    {
      schema: {
        response: {
          200: InventoryBatchListRes
        },
        params: InventoryBatchParams
      }
    },
    async (request, reply) => {
      const batches = await getListInventoryBatchesByStockId(request.params.id)
      reply.send({
        data: batches as InventoryBatchListResType['data'],
        message: 'Lấy danh sách lô hàng thành công!'
      })
    }
  )
}
