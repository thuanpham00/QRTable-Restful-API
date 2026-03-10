import {
  createSupply,
  deleteSupply,
  getIngredientNotLink,
  getSupplyDetail,
  getSupplyList,
  updateSupply
} from '@/controllers/supply.controller'
import { pauseApiHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import { IngredientListRes, IngredientListResType } from '@/schemaValidations/ingredient.schema'
import {
  CreateSupplierIngredientBody,
  CreateSupplierIngredientBodyType,
  SupplierIngredientListRes,
  SupplierIngredientListResType,
  SupplierIngredientParams,
  SupplierIngredientParams_2,
  SupplierIngredientParams_2_Type,
  SupplierIngredientParamsType,
  SupplierIngredientRes,
  SupplierIngredientResType,
  UpdateSupplierIngredientBody,
  UpdateSupplierIngredientBodyType
} from '@/schemaValidations/supplierIngredient.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function suppliesRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook]], {
      relation: 'and'
    })
  )

  fastify.get<{
    Params: SupplierIngredientParams_2_Type
    Reply: SupplierIngredientListResType
  }>(
    '/list/:supplierId',
    {
      schema: {
        params: SupplierIngredientParams_2,
        response: {
          200: SupplierIngredientListRes
        }
      }
    },
    async (request, reply) => {
      const { supplierId: id } = request.params as SupplierIngredientParams_2_Type
      const { data } = await getSupplyList(id)
      console.log(data)
      reply.send({
        data: data as SupplierIngredientListResType['data'],
        message: 'Lấy danh sách nguyên liệu của nhà cung cấp thành công!'
      })
    }
  )

  // GET /suppliers/:id - Lấy danh sach nguyên liệu còn lại (nhà cung cấp chưa link)
  fastify.get<{
    Params: SupplierIngredientParams_2_Type
    Reply: IngredientListResType
  }>(
    '/not-linked/:supplierId',
    {
      schema: {
        params: SupplierIngredientParams_2,
        response: {
          200: IngredientListRes
        }
      }
    },
    async (request, reply) => {
      const { supplierId: id } = request.params as SupplierIngredientParams_2_Type
      const data = await getIngredientNotLink(id)
      reply.send({
        data: data as IngredientListResType['data'],
        message: 'Lấy danh sách nguyên liệu chưa liên kết thành công!',
        pagination: null
      })
    }
  )

  // GET /supply/:id - Lấy chi tiết nhà cung cấp - nguyên liệu
  fastify.get<{
    Params: SupplierIngredientParamsType
    Reply: SupplierIngredientResType
  }>(
    '/:id',
    {
      schema: {
        params: SupplierIngredientParams,
        response: {
          200: SupplierIngredientRes
        }
      }
    },
    async (request, reply) => {
      const supplier = await getSupplyDetail(request.params.id)
      reply.send({
        data: supplier as SupplierIngredientResType['data'],
        message: 'Lấy thông tin nhà cung cấp - nguyên liệu thành công!'
      })
    }
  )

  // POST /suppliers - Tạo link nhà cung cấp - nguyên liệu mới
  fastify.post<{
    Body: CreateSupplierIngredientBodyType
    Reply: SupplierIngredientResType
  }>(
    '/',
    {
      schema: {
        body: CreateSupplierIngredientBody,
        response: {
          200: SupplierIngredientRes
        }
      }
    },
    async (request, reply) => {
      const supplier = await createSupply(request.body)
      reply.send({
        data: supplier as SupplierIngredientResType['data'],
        message: 'Tạo link nhà cung cấp - nguyên liệu thành công!'
      })
    }
  )

  // PUT /suppliers/:id - Cập nhật link nhà cung cấp - nguyên liệu mới
  fastify.put<{
    Params: SupplierIngredientParamsType
    Body: UpdateSupplierIngredientBodyType
    Reply: SupplierIngredientResType
  }>(
    '/:id',
    {
      schema: {
        params: SupplierIngredientParams,
        body: UpdateSupplierIngredientBody,
        response: {
          200: SupplierIngredientRes
        }
      }
    },
    async (request, reply) => {
      const supplier = await updateSupply(request.params.id, request.body)
      reply.send({
        data: supplier as SupplierIngredientResType['data'],
        message: 'Cập nhật link nhà cung cấp - nguyên liệu thành công!'
      })
    }
  )

  // DELETE /suppliers/:id - Xóa link nhà cung cấp - nguyên liệu
  fastify.delete<{
    Params: SupplierIngredientParamsType
    Reply: SupplierIngredientResType
  }>(
    '/:id',
    {
      schema: {
        params: SupplierIngredientParams,
        response: {
          200: SupplierIngredientRes
        }
      }
    },
    async (request, reply) => {
      const result = await deleteSupply(request.params.id)
      reply.send({
        message: 'Xóa link nhà cung cấp - nguyên liệu thành công!',
        data: result as SupplierIngredientResType['data']
      })
    }
  )
}
