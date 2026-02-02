import { DishStatus } from '@/constants/type'
import prisma from '@/database'
import {
  AddDishToMenuType,
  MenuQueryType,
  UpdateDishInMenuType,
  UpdateMenuBodyType
} from '@/schemaValidations/menu.schema'

export const getMenuList = async ({ page, limit, name }: MenuQueryType) => {
  const skip = (page - 1) * limit

  const whereCondition = name
    ? { name: { contains: name } } // ← Bỏ mode: 'insensitive'
    : {}

  const [menus, total] = await Promise.all([
    prisma.menu.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { menuItems: true }
        }
      },
      where: whereCondition // ← Dùng chung
    }),
    prisma.menu.count({
      where: whereCondition // ← Đếm theo điều kiện
    })
  ])

  return {
    data: menus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      description: menu.description,
      version: menu.version,
      isActive: menu.isActive,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      countMenuItems: menu._count.menuItems
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

export const getMenuIsActive = async () => {
  return prisma.menu.findFirst({
    where: {
      isActive: true
    },
    include: {
      menuItems: {
        include: {
          dish: {
            include: {
              category: true
            }
          }
        }
      }
    }
  })
}

export const getSuggestedMenu = async () => {
  // Get top 5 dishes by popularity, then return their menuItems belonging to an active menu
  const top = await prisma.dish.findMany({
    orderBy: { popularity: 'desc' },
    take: 5,
    select: { id: true }
  })
  const topIds = top.map((t) => t.id)

  const items = await prisma.menuItem.findMany({
    where: {
      dishId: { in: topIds },
      menu: { isActive: true }
    },
    include: {
      dish: { include: { category: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return items
}

export const getMenuDetail = (id: number) => {
  return prisma.menu.findUniqueOrThrow({
    where: {
      id
    }
  })
}

export const createMenu = (data: UpdateMenuBodyType) => {
  return prisma.menu.create({
    data
  })
}

export const updateMenu = (id: number, data: UpdateMenuBodyType) => {
  // nếu có 1 menu nào đó đang có isActive = true thì throw lỗi không cho cập nhật và ngược lại thì cho cập nhật
  if (data.isActive === true) {
    return prisma.$transaction(async (prisma) => {
      const activeMenu = await prisma.menu.findFirst({
        where: {
          isActive: true,
          id: { not: id } // ← Loại trừ menu hiện tại
        }
      })
      if (activeMenu) {
        throw new Error(
          'Đã có menu khác đang được kích hoạt. Vui lòng tắt kích hoạt menu đó trước khi kích hoạt menu này.'
        )
      }
      return prisma.menu.update({
        where: {
          id
        },
        data: {
          ...data,
          version: { increment: 1 }
        }
      })
    })
  }
  // tăng version lên 1 mỗi khi cập nhật
  return prisma.menu.update({
    where: {
      id
    },

    data: {
      ...data,
      version: { increment: 1 }
    }
  })
}

export const deleteMenu = async (id: number) => {
  const checkStatusMenu = await prisma.menu.findFirst({
    where: {
      id
    }
  })
  if (checkStatusMenu?.isActive) {
    throw new Error('Không thể xóa menu đang được kích hoạt!')
  }
  // xóa các menuItem thuộc menu này trước
  await prisma.menuItem.deleteMany({
    where: {
      menuId: id
    }
  })
  return prisma.menu.delete({
    where: {
      id
    }
  })
}

export const getMenuItemFromMenu = async (menuId: number) => {
  const list = await prisma.menuItem.findMany({
    where: {
      menuId
    },
    orderBy: { createdAt: 'desc' },
    include: {
      dish: {
        include: {
          category: true
        }
      }
    }
  })
  return {
    itemList: list,
    menu: await getMenuDetail(menuId)
  }
}

export const getMenuItemDetail = async (menuItemId: number) => {
  return await prisma.menuItem.findFirst({
    where: {
      id: menuItemId
    },
    include: {
      dish: {
        include: {
          category: true
        }
      }
    }
  })
}

export const addMenuItemToMenu = async (data: AddDishToMenuType) => {
  const findDish = await prisma.dish.findFirst({
    where: {
      id: data.dishId
    }
  })

  if (!findDish || findDish.status === DishStatus.Discontinued) {
    throw new Error('Món ăn tạm ngưng!')
  }

  if (data.price <= findDish?.price) {
    throw new Error('Giá món ăn trong menu phải cao hơn giá gốc của món ăn!')
  }

  const checkDishExistInMenu = await prisma.menuItem.findFirst({
    where: {
      dishId: data.dishId,
      menuId: data.menuId
    }
  })

  if (checkDishExistInMenu) {
    throw new Error('Món ăn đã tồn tại trong menu!')
  }

  return prisma.menuItem.create({
    data,
    include: {
      dish: {
        include: {
          category: true
        }
      }
    }
  })
}

export const updateDishInMenu = async (id: number, data: UpdateDishInMenuType) => {
  const findDish = await prisma.dish.findFirst({
    where: {
      id: data.dishId
    }
  })

  if (!findDish || findDish.status === DishStatus.Discontinued) {
    throw new Error('Món ăn tạm ngưng!')
  }

  if (data.price <= findDish?.price) {
    throw new Error('Giá món ăn trong menu phải cao hơn giá gốc của món ăn!')
  }

  const findMenuItem = await prisma.menuItem.findFirst({
    where: {
      id
    }
  })

  const checkDishExistInMenu = await prisma.menuItem.findFirst({
    where: {
      dishId: data.dishId,
      menuId: findMenuItem?.menuId,
      id: { not: id } // loại trừ chính nó
    }
  })

  if (checkDishExistInMenu) {
    throw new Error('Món ăn đã tồn tại trong menu!')
  }

  return prisma.menuItem.update({
    where: {
      id
    },
    data,
    include: {
      dish: {
        include: {
          category: true
        }
      }
    }
  })
}

export const deleteMenuItem = async (id: number) => {
  return prisma.menuItem.delete({
    where: {
      id
    },
    include: {
      dish: {
        include: {
          category: true
        }
      }
    }
  })
}
