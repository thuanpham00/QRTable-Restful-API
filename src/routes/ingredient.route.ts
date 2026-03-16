import {
  createIngredient,
  deleteIngredient,
  getIngredientDetail,
  getIngredientList,
  updateIngredient
} from '@/controllers/ingredient.controller'
import { requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  CreateIngredientBody,
  CreateIngredientBodyType,
  IngredientListRes,
  IngredientListResType,
  IngredientParams,
  IngredientParamsType,
  IngredientQuery,
  IngredientQueryType,
  IngredientRes,
  IngredientResType,
  UpdateIngredientBody,
  UpdateIngredientBodyType
} from '@/schemaValidations/ingredient.schema'

import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function ingredientRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, requireOwnerHook], {
      relation: 'and'
    })
  )
  fastify.get<{
    Reply: IngredientListResType
    Querystring: IngredientQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: IngredientListRes
        },
        querystring: IngredientQuery
      }
    },
    async (request, reply) => {
      const { data, pagination } = await getIngredientList({
        page: request.query.page || 1,
        limit: request.query.limit || 10,
        name: request.query.name,
        category: request.query.category,
        unit: request.query.unit,
        pagination: request.query.pagination
      })
      reply.send({
        data: data as IngredientListResType['data'],
        pagination,
        message: 'Lấy danh sách nguyên liệu thành công!'
      })
    }
  )

  fastify.get<{
    Params: IngredientParamsType
    Reply: IngredientResType
  }>(
    '/:id',
    {
      schema: {
        params: IngredientParams,
        response: {
          200: IngredientRes
        }
      }
    },
    async (request, reply) => {
      const ingredient = await getIngredientDetail(request.params.id)
      reply.send({ data: ingredient as IngredientResType['data'], message: 'Lấy thông tin nguyên liệu thành công!' })
    }
  )

  fastify.post<{
    Body: CreateIngredientBodyType
    Reply: IngredientResType
  }>(
    '',
    {
      schema: {
        body: CreateIngredientBody,
        response: {
          200: IngredientRes
        }
      }
    },
    async (request, reply) => {
      const ingredient = await createIngredient(request.body)
      reply.send({ data: ingredient as IngredientResType['data'], message: 'Tạo nguyên liệu thành công!' })
    }
  )

  fastify.put<{
    Params: IngredientParamsType
    Body: UpdateIngredientBodyType
    Reply: IngredientResType
  }>(
    '/:id',
    {
      schema: {
        params: IngredientParams,
        body: UpdateIngredientBody,
        response: {
          200: IngredientRes
        }
      }
    },
    async (request, reply) => {
      const ingredient = await updateIngredient(request.params.id, request.body)
      reply.send({ data: ingredient as IngredientResType['data'], message: 'Cập nhật nguyên liệu thành công!' })
    }
  )

  fastify.delete<{
    Params: IngredientParamsType
    Reply: IngredientResType
  }>(
    '/:id',
    {
      schema: {
        params: IngredientParams,
        response: {
          200: IngredientRes
        }
      }
    },
    async (request, reply) => {
      const result = await deleteIngredient(request.params.id)
      reply.send({ message: 'Xóa nguyên liệu thành công!', data: result as IngredientResType['data'] })
    }
  )
}
