import { ManagerRoom } from '@/constants/type'
import {
  addMenuItemToMenu,
  createMenu,
  deleteMenu,
  deleteMenuItem,
  getMenuDetail,
  getMenuIsActive,
  getMenuItemDetail,
  getMenuItemFromMenu,
  getMenuList,
  getSuggestedMenu,
  updateDishInMenu,
  updateMenu
} from '@/controllers/menu.controller'
import { pauseApiHook, requireEmployeeHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  AddDishToMenu,
  AddDishToMenuType,
  CreateMenuBody,
  CreateMenuBodyType,
  MenuActiveRes,
  MenuActiveResType,
  MenuItemListRes,
  MenuItemListResType,
  MenuItemRes,
  MenuItemResType,
  MenuItemSuggestRes,
  MenuItemSuggestResType,
  MenuListRes,
  MenuListResType,
  MenuParams,
  MenuParamsType,
  MenuQuery,
  MenuQueryType,
  MenuRes,
  MenuResType,
  UpdateDishInMenu,
  UpdateDishInMenuType,
  UpdateMenuBody,
  UpdateMenuBodyType
} from '@/schemaValidations/menu.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function menusRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get<{
    Reply: MenuListResType
    Querystring: MenuQueryType
  }>(
    '/',
    {
      schema: {
        response: {
          200: MenuListRes
        },
        querystring: MenuQuery
      }
    },
    async (request, reply) => {
      const { data, pagination } = await getMenuList({
        page: request.query.page || 1,
        limit: request.query.limit || 5,
        name: request.query.name
      })
      reply.send({
        data: data as MenuListResType['data'],
        pagination: pagination,
        message: 'Lấy danh sách menu thành công!'
      })
    }
  ),
    fastify.get<{
      Reply: MenuActiveResType
    }>(
      '/active',
      {
        schema: {
          response: {
            200: MenuActiveRes
          }
        }
      },
      async (request, reply) => {
        const data = await getMenuIsActive()
        reply.send({
          data: data as MenuActiveResType['data'],
          message: 'Lấy menu đang kích hoạt thành công!'
        })
      }
    ),
    fastify.get<{
      Reply: MenuItemSuggestResType
    }>(
      '/suggested',
      {
        schema: {
          response: {
            200: MenuItemSuggestRes
          }
        }
      },
      async (request, reply) => {
        const data = await getSuggestedMenu()
        reply.send({
          data: data as MenuItemSuggestResType['data'],
          message: 'Lấy món ăn đề xuất thành công!'
        })
      }
    ),
    fastify.get<{
      Params: MenuParamsType
      Reply: MenuResType
    }>(
      '/:id',
      {
        schema: {
          params: MenuParams,
          response: {
            200: MenuRes
          }
        }
      },
      async (request, reply) => {
        const dish = await getMenuDetail(request.params.id)
        reply.send({
          data: dish as MenuResType['data'],
          message: 'Lấy thông tin menu thành công!'
        })
      }
    )

  fastify.post<{
    Body: CreateMenuBodyType
    Reply: MenuResType
  }>(
    '',
    {
      schema: {
        body: CreateMenuBody,
        response: {
          200: MenuRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const menu = await createMenu(request.body)
      fastify.io.to(ManagerRoom).emit('update-menu', menu)
      reply.send({
        data: menu as MenuResType['data'],
        message: 'Tạo menu thành công!'
      })
    }
  )

  fastify.put<{
    Params: MenuParamsType
    Body: UpdateMenuBodyType
    Reply: MenuResType
  }>(
    '/:id',
    {
      schema: {
        params: MenuParams,
        body: UpdateMenuBody,
        response: {
          200: MenuRes
        }
      },

      preValidation: fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const menu = await updateMenu(request.params.id, request.body)
      fastify.io.to(ManagerRoom).emit('update-menu', menu)
      reply.send({
        data: menu as MenuResType['data'],
        message: 'Cập nhật menu thành công!'
      })
    }
  )

  fastify.delete<{
    Params: MenuParamsType
    Reply: MenuResType
  }>(
    '/:id',
    {
      schema: {
        params: MenuParams,
        response: {
          200: MenuRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const result = await deleteMenu(request.params.id)
      fastify.io.to(ManagerRoom).emit('update-menu', result)
      reply.send({
        message: 'Xóa menu thành công!',
        data: result as MenuResType['data']
      })
    }
  )
  // lấy danh sách món ăn trong menu
  fastify.get<{
    Params: MenuParamsType
    Reply: MenuItemListResType
  }>(
    '/:id/items',
    {
      schema: {
        params: MenuParams,
        response: {
          200: MenuItemListRes
        }
      }
    },
    async (request, reply) => {
      const menuItemList = await getMenuItemFromMenu(request.params.id)
      reply.send({
        data: menuItemList as MenuItemListResType['data'],
        message: 'Lấy danh sách món ăn menu thành công!'
      })
    }
  )

  // lấy chi tiết menuItem
  fastify.get<{
    Params: MenuParamsType
    Reply: MenuItemResType
  }>(
    '/menu-item/:id',
    {
      schema: {
        params: MenuParams,
        response: {
          200: MenuItemRes
        }
      }
    },
    async (request, reply) => {
      const menuItem = await getMenuItemDetail(request.params.id)
      reply.send({
        data: menuItem as MenuItemResType['data'],
        message: 'Lấy chi tiết món ăn trong menu thành công!'
      })
    }
  )

  // thêm món ăn vào menu
  fastify.post<{
    Body: AddDishToMenuType
    Reply: MenuItemResType
  }>(
    '/menu-item',
    {
      schema: {
        body: AddDishToMenu,
        response: {
          200: MenuItemRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const menuItemList = await addMenuItemToMenu(request.body)
      fastify.io.to(ManagerRoom).emit('update-menu-item', menuItemList)
      reply.send({
        data: menuItemList as MenuItemResType['data'],
        message: 'Thêm món ăn vào menu thành công!'
      })
    }
  )

  // cập nhật món ăn trong menu
  fastify.put<{
    Params: MenuParamsType
    Body: UpdateDishInMenuType
    Reply: MenuItemResType
  }>(
    '/menu-item/:id',
    {
      schema: {
        params: MenuParams,
        body: UpdateDishInMenu,
        response: {
          200: MenuItemRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const menuItemList = await updateDishInMenu(request.params.id, request.body)
      fastify.io.to(ManagerRoom).emit('update-menu-item', menuItemList)
      reply.send({
        data: menuItemList as MenuItemResType['data'],
        message: 'Cập nhật món ăn trong menu thành công!'
      })
    }
  )

  // xóa món ăn trong menu
  fastify.delete<{
    Params: MenuParamsType
    Reply: MenuItemResType
  }>(
    '/menu-item/:id',
    {
      schema: {
        params: MenuParams,
        response: {
          200: MenuItemRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, pauseApiHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const result = await deleteMenuItem(request.params.id)
      fastify.io.to(ManagerRoom).emit('update-menu-item', result)
      reply.send({
        message: 'Xóa món ăn trong menu thành công!',
        data: result as MenuItemResType['data']
      })
    }
  )
}
