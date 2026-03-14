import { DishStatus, GuestRoom, ManagerRoom, MenuItemStatus } from '@/constants/type'
import prisma from '@/database'
import { Cron } from 'croner'
import { FastifyInstance } from 'fastify'

const autoUpdateStatusDishOutStockIngredient = (fastify: FastifyInstance) => {
  // Chạy mỗi phút
  Cron('* * * * *', async () => {
    try {
      console.log('[Cron] Updating dish out-of-stock status...')

      // check từng món ăn coi các nguyên liệu của món này có đủ phục vụ không
      // rồi check tới từng menuItem liên quan để set status menuItem
      const dishList = await prisma.dish.findMany({
        where: {
          status: DishStatus.Active
        },
        include: {
          dishIngredients: {
            include: {
              ingredient: {
                include: {
                  inventoryStock: true
                }
              }
            }
          }
        }
      })

      const outOfStockDishIds: number[] = []
      const inStockDishIds: number[] = []

      for (const dish of dishList) {
        if (dish.dishIngredients.length === 0) {
          // Món không có nguyên liệu → luôn khả dụng
          inStockDishIds.push(dish.id)
          continue
        }

        const isOutOfStock = dish.dishIngredients.some((item) => {
          const stock = item.ingredient.inventoryStock
          return !stock || stock.quantity < Number(item.quantity ?? 0)
        })

        if (isOutOfStock) {
          outOfStockDishIds.push(dish.id)
        } else {
          inStockDishIds.push(dish.id)
        }
      }

      await Promise.all([
        outOfStockDishIds.length > 0
          ? prisma.menuItem.updateMany({
              where: {
                dishId: { in: outOfStockDishIds },
                status: {
                  not: MenuItemStatus.HIDDEN
                }
              },
              data: {
                status: MenuItemStatus.OUT_OF_STOCK
              }
            })
          : Promise.resolve(),

        inStockDishIds.length > 0
          ? prisma.menuItem.updateMany({
              where: {
                dishId: { in: inStockDishIds },
                status: MenuItemStatus.OUT_OF_STOCK
              },
              data: {
                status: MenuItemStatus.AVAILABLE
              }
            })
          : Promise.resolve()
      ])

      console.log(
        `[Cron] OutOfStock: ${outOfStockDishIds.length} dish(es), Restored: ${inStockDishIds.length} dish(es)`
      )

      if (fastify.io && (outOfStockDishIds.length > 0 || inStockDishIds.length > 0)) {
        // cập nhật thì mới bắn socket
        fastify.io.to(ManagerRoom).to(GuestRoom).emit('update-status-dish-from-stock')
      } else {
        console.warn('[Cron] Socket.IO not available, skipping emit')
      }
    } catch (error) {
      console.error('[Cron] Error updating dish status from stock:', error)
    }
  })
}

export default autoUpdateStatusDishOutStockIngredient
