import {
  createSupplier,
  deleteSupplier,
  getSupplierDetail,
  getSupplierList,
  getSupplierOptions,
  updateSupplier
} from '@/controllers/supplier.controller'
import { requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  CreateSupplierBody,
  CreateSupplierBodyType,
  SupplierListRes,
  SupplierListResType,
  SupplierOptionsRes,
  SupplierOptionsResType,
  SupplierParams,
  SupplierParamsType,
  SupplierQuery,
  SupplierQueryType,
  SupplierRes,
  SupplierResType,
  UpdateSupplierBody,
  UpdateSupplierBodyType
} from '@/schemaValidations/supplier.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function supplierRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, requireOwnerHook], {
      relation: 'and'
    })
  )
  // GET /suppliers - Lấy danh sách nhà cung cấp
  fastify.get<{
    Reply: SupplierListResType
    Querystring: SupplierQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: SupplierListRes
        },
        querystring: SupplierQuery
      }
    },
    async (request, reply) => {
      const { data, pagination } = await getSupplierList({
        page: request.query.page || 1,
        limit: request.query.limit || 10,
        name: request.query.name,
        status: request.query.status
      })
      reply.send({
        data: data as SupplierListResType['data'],
        pagination: pagination,
        message: 'Lấy danh sách nhà cung cấp thành công!'
      })
    }
  )

  // GET /suppliers/options - Lấy danh sách đơn giản (id, name) cho dropdown
  fastify.get<{
    Reply: SupplierOptionsResType
  }>(
    '/options',
    {
      schema: {
        response: {
          200: SupplierOptionsRes
        }
      }
    },
    async (request, reply) => {
      const data = await getSupplierOptions()
      reply.send({
        data,
        message: 'Lấy danh sách nhà cung cấp thành công!'
      })
    }
  )

  // GET /suppliers/:id - Lấy chi tiết nhà cung cấp
  fastify.get<{
    Params: SupplierParamsType
    Reply: SupplierResType
  }>(
    '/:id',
    {
      schema: {
        params: SupplierParams,
        response: {
          200: SupplierRes
        }
      }
    },
    async (request, reply) => {
      const supplier = await getSupplierDetail(request.params.id)
      reply.send({
        data: supplier as SupplierResType['data'],
        message: 'Lấy thông tin nhà cung cấp thành công!'
      })
    }
  )

  // POST /suppliers - Tạo nhà cung cấp mới
  fastify.post<{
    Body: CreateSupplierBodyType
    Reply: SupplierResType
  }>(
    '/',
    {
      schema: {
        body: CreateSupplierBody,
        response: {
          200: SupplierRes
        }
      }
    },
    async (request, reply) => {
      const supplier = await createSupplier(request.body)
      reply.send({
        data: supplier as SupplierResType['data'],
        message: 'Tạo nhà cung cấp thành công!'
      })
    }
  )

  // PUT /suppliers/:id - Cập nhật nhà cung cấp
  fastify.put<{
    Params: SupplierParamsType
    Body: UpdateSupplierBodyType
    Reply: SupplierResType
  }>(
    '/:id',
    {
      schema: {
        params: SupplierParams,
        body: UpdateSupplierBody,
        response: {
          200: SupplierRes
        }
      }
    },
    async (request, reply) => {
      const supplier = await updateSupplier(request.params.id, request.body)
      reply.send({
        data: supplier as SupplierResType['data'],
        message: 'Cập nhật nhà cung cấp thành công!'
      })
    }
  )

  // DELETE /suppliers/:id - Xóa nhà cung cấp
  fastify.delete<{
    Params: SupplierParamsType
    Reply: SupplierResType
  }>(
    '/:id',
    {
      schema: {
        params: SupplierParams,
        response: {
          200: SupplierRes
        }
      }
    },
    async (request, reply) => {
      const result = await deleteSupplier(request.params.id)
      reply.send({
        message: 'Xóa nhà cung cấp thành công!',
        data: result as SupplierResType['data']
      })
    }
  )
}
