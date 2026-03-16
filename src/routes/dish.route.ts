import {
  addIngredientToDish,
  createDish,
  deleteDish,
  deleteIngredientFromDish,
  getDishDetail,
  getDishIngredientDetail,
  getDishList,
  getIngredientDishList,
  updateDish,
  updateIngredientToDish
} from '@/controllers/dish.controller'
import { requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  AddIngredientToDish,
  AddIngredientToDishType,
  CreateDishBody,
  CreateDishBodyType,
  DishIngredientListRes,
  DishIngredientListResType,
  DishIngredientRes,
  DishIngredientResType,
  DishListRes,
  DishListResType,
  DishListWithPaginationQuery,
  DishListWithPaginationQueryType,
  DishListWithPaginationRes,
  DishListWithPaginationResType,
  DishParams,
  DishParamsType,
  DishQuery,
  DishQueryType,
  DishRes,
  DishResType,
  UpdateDishBody,
  UpdateDishBodyType,
  UpdateIngredientInDish,
  UpdateIngredientInDishType
} from '@/schemaValidations/dish.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function dishRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook(
    'preValidation',
    fastify.auth([requireLoginedHook, requireOwnerHook], {
      relation: 'and'
    })
  )

  fastify.get<{
    Reply: DishListResType
    Querystring: DishQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: DishListRes
        },
        querystring: DishQuery
      }
    },
    async (request, reply) => {
      const { data, pagination } = await getDishList({
        page: request.query.page || 1,
        limit: request.query.limit || 5,
        name: request.query.name,
        categoryId: request.query.categoryId,
        pagination: request.query.pagination
      })
      reply.send({
        data: data as DishListResType['data'],
        pagination: pagination,
        message: 'Lấy danh sách món ăn thành công!'
      })
    }
  )

  fastify.get<{
    Params: DishParamsType
    Reply: DishResType
  }>(
    '/:id',
    {
      schema: {
        params: DishParams,
        response: {
          200: DishRes
        }
      }
    },
    async (request, reply) => {
      const dish = await getDishDetail(request.params.id)
      reply.send({
        data: dish as DishResType['data'],
        message: 'Lấy thông tin món ăn thành công!'
      })
    }
  )

  fastify.post<{
    Body: CreateDishBodyType
    Reply: DishResType
  }>(
    '',
    {
      schema: {
        body: CreateDishBody,
        response: {
          200: DishRes
        }
      }
    },
    async (request, reply) => {
      const dish = await createDish(request.body)
      reply.send({
        data: dish as DishResType['data'],
        message: 'Tạo món ăn thành công!'
      })
    }
  )

  fastify.put<{
    Params: DishParamsType
    Body: UpdateDishBodyType
    Reply: DishResType
  }>(
    '/:id',
    {
      schema: {
        params: DishParams,
        body: UpdateDishBody,
        response: {
          200: DishRes
        }
      }
    },
    async (request, reply) => {
      const dish = await updateDish(request.params.id, request.body)
      reply.send({
        data: dish as DishResType['data'],
        message: 'Cập nhật món ăn thành công!'
      })
    }
  )

  fastify.delete<{
    Params: DishParamsType
    Reply: DishResType
  }>(
    '/:id',
    {
      schema: {
        params: DishParams,
        response: {
          200: DishRes
        }
      }
    },
    async (request, reply) => {
      const result = await deleteDish(request.params.id)
      reply.send({
        message: 'Xóa món ăn thành công!',
        data: result as DishResType['data']
      })
    }
  )

  // lấy danh sách món ăn trong menu
  fastify.get<{
    Params: DishParamsType
    Reply: DishIngredientListResType
  }>(
    '/:id/ingredients',
    {
      schema: {
        params: DishParams,
        response: {
          200: DishIngredientListRes
        }
      }
    },
    async (request, reply) => {
      const menuItemList = await getIngredientDishList(request.params.id)
      reply.send({
        data: menuItemList as DishIngredientListResType['data'],
        message: 'Lấy danh sách nguyên liệu món ăn thành công!'
      })
    }
  )

  // lấy chi tiết menuItem
  fastify.get<{
    Params: DishParamsType
    Reply: DishIngredientResType
  }>(
    '/ingredient-item/:id',
    {
      schema: {
        params: DishParams,
        response: {
          200: DishIngredientRes
        }
      }
    },
    async (request, reply) => {
      const dishIngredient = await getDishIngredientDetail(request.params.id)
      reply.send({
        data: dishIngredient as DishIngredientResType['data'],
        message: 'Lấy chi tiết nguyên liệu trong món ăn thành công!'
      })
    }
  )

  // thêm nguyên liệu vào món ăn
  fastify.post<{
    Body: AddIngredientToDishType
    Reply: DishIngredientResType
  }>(
    '/ingredient-item',
    {
      schema: {
        body: AddIngredientToDish,
        response: {
          200: DishIngredientRes
        }
      }
    },
    async (request, reply) => {
      const menuItemList = await addIngredientToDish(request.body)
      reply.send({
        data: menuItemList as DishIngredientResType['data'],
        message: 'Thêm nguyên liệu vào món ăn thành công!'
      })
    }
  )

  // cập nhật nguyên liệu trong món ăn
  fastify.put<{
    Params: DishParamsType
    Body: UpdateIngredientInDishType
    Reply: DishIngredientResType
  }>(
    '/ingredient-item/:id',
    {
      schema: {
        params: DishParams,
        body: UpdateIngredientInDish,
        response: {
          200: DishIngredientRes
        }
      }
    },
    async (request, reply) => {
      const menuItemList = await updateIngredientToDish(request.params.id, request.body)
      reply.send({
        data: menuItemList as DishIngredientResType['data'],
        message: 'Cập nhật nguyên liệu trong món ăn thành công!'
      })
    }
  )

  // xóa món ăn trong menu
  fastify.delete<{
    Params: DishParamsType
    Reply: DishIngredientResType
  }>(
    '/ingredient-item/:id',
    {
      schema: {
        params: DishParams,
        response: {
          200: DishIngredientRes
        }
      }
    },
    async (request, reply) => {
      const result = await deleteIngredientFromDish(request.params.id)
      reply.send({
        message: 'Xóa nguyên liệu trong món ăn thành công!',
        data: result as DishIngredientResType['data']
      })
    }
  )
}
