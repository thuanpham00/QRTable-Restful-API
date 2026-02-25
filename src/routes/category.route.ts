import {
  createDishCategory,
  deleteDishCategory,
  getDishCategoryDetail,
  getDishCategoryList,
  getListNameDishCategory,
  updateDishCategory
} from '@/controllers/dishCategory.controller'
import { pauseApiHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import { DishParamsType } from '@/schemaValidations/dish.schema'
import {
  CreateDishCategoryBody,
  CreateDishCategoryBodyType,
  DishCategoryListRes,
  DishCategoryListResType,
  DishCategoryNameListRes,
  DishCategoryNameListResType,
  DishCategoryParams,
  DishCategoryParamsType,
  DishCategoryQuery,
  DishCategoryQueryType,
  DishCategoryRes,
  DishCategoryResType,
  UpdateDishCategoryBody,
  UpdateDishCategoryBodyType
} from '@/schemaValidations/dishCategory.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function categoryRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get<{
    Reply: DishCategoryListResType
    Querystring: DishCategoryQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: DishCategoryListRes
        },
        querystring: DishCategoryQuery
      }
    },
    async (request, reply) => {
      const { data, pagination } = await getDishCategoryList({
        page: request.query.page || 1,
        limit: request.query.limit || 5,
        name: request.query.name
      })
      reply.send({
        data: data as DishCategoryListResType['data'],
        pagination: pagination,
        message: 'Lấy danh sách danh mục món ăn thành công!'
      })
    }
  ),
    fastify.get<{
      Params: DishParamsType
      Reply: DishCategoryResType
    }>(
      '/:id',
      {
        schema: {
          params: DishCategoryParams,
          response: {
            200: DishCategoryRes
          }
        }
      },
      async (request, reply) => {
        const dish = await getDishCategoryDetail(request.params.id)
        reply.send({
          data: dish as DishCategoryResType['data'],
          message: 'Lấy thông tin danh mục món ăn thành công!'
        })
      }
    )

  fastify.post<{
    Body: CreateDishCategoryBodyType
    Reply: DishCategoryResType
  }>(
    '',
    {
      schema: {
        body: CreateDishCategoryBody,
        response: {
          200: DishCategoryRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const dishCategory = await createDishCategory(request.body)
      reply.send({
        data: dishCategory as DishCategoryResType['data'],
        message: 'Tạo danh mục món ăn thành công!'
      })
    }
  )

  fastify.put<{
    Params: DishCategoryParamsType
    Body: UpdateDishCategoryBodyType
    Reply: DishCategoryResType
  }>(
    '/:id',
    {
      schema: {
        params: DishCategoryParams,
        body: UpdateDishCategoryBody,
        response: {
          200: DishCategoryRes
        }
      },

      preValidation: fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const dishCategory = await updateDishCategory(request.params.id, request.body)
      reply.send({
        data: dishCategory as DishCategoryResType['data'],
        message: 'Cập nhật danh mục món ăn thành công!'
      })
    }
  )

  fastify.delete<{
    Params: DishCategoryParamsType
    Reply: DishCategoryResType
  }>(
    '/:id',
    {
      schema: {
        params: DishCategoryParams,
        response: {
          200: DishCategoryRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const result = await deleteDishCategory(request.params.id)
      reply.send({
        message: 'Xóa danh mục món ăn thành công!',
        data: result as DishCategoryResType['data']
      })
    }
  )

  fastify.get<{
    Reply: DishCategoryNameListResType
  }>(
    '/names',
    {
      schema: {
        response: {
          200: DishCategoryNameListRes
        }
      }
    },
    async (request, reply) => {
      const data = await getListNameDishCategory()
      reply.send({
        data: data as DishCategoryNameListResType['data'],
        message: 'Lấy danh sách tên danh mục món ăn thành công!'
      })
    }
  )
}
