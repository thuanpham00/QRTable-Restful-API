import { DishStatus, MenuItemStatus } from '@/constants/type'
import prisma from '@/database'
import {
  CreateDishBodyType,
  DishQueryType,
  UpdateDishBodyType,
  AddIngredientToDishType,
  UpdateIngredientInDishType
} from '@/schemaValidations/dish.schema'

export const getDishList = async ({ page, limit, name, categoryId, pagination }: DishQueryType) => {
  if (pagination === 'false') {
    const dishes = await prisma.dish.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true
      }
    })
    return {
      data: dishes,
      pagination: null
    }
  }

  const skip = (page - 1) * limit

  const whereCondition = name
    ? { name: { contains: name } } // ← Bỏ mode: 'insensitive'
    : {}

  const whereCategoryId = categoryId
    ? {
        categoryId: Number(categoryId)
      }
    : {}

  const [dishes, total] = await Promise.all([
    prisma.dish.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true
      },
      where: {
        ...whereCondition,
        ...whereCategoryId
      }
    }),
    prisma.dish.count({
      where: {
        ...whereCondition,
        ...whereCategoryId
      }
    })
  ])

  return {
    data: dishes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

export const getDishListWithPagination = async (page: number, limit: number) => {
  const data = await prisma.dish.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    skip: (page - 1) * limit,
    take: limit
  })
  const totalItem = await prisma.dish.count()
  const totalPage = Math.ceil(totalItem / limit)
  return {
    items: data,
    totalItem,
    page,
    limit,
    totalPage
  }
}

export const getDishDetail = (id: number) => {
  return prisma.dish.findUniqueOrThrow({
    where: {
      id
    },
    include: {
      category: true
    }
  })
}

export const createDish = (data: CreateDishBodyType) => {
  return prisma.dish.create({
    data: {
      name: data.name,
      price: data.price,
      description: data.description || '',
      image: data.image,
      status: data.status,
      categoryId: Number(data.categoryId),

      dietaryTags: data.dietaryTags,
      spicyLevel: data.spicyLevel,
      preparationTime: data.preparationTime,
      searchKeywords: data.searchKeywords,
      popularity: data.popularity
    },
    include: {
      category: true
    }
  })
}

export const updateDish = async (id: number, data: UpdateDishBodyType) => {
  if (data.status === DishStatus.Discontinued) {
    // nếu món ăn bị ngưng phục vụ thì set tất cả menuItem liên quan về hidden
    await prisma.menuItem.updateMany({
      where: {
        dishId: id
      },
      data: {
        status: MenuItemStatus.HIDDEN
      }
    })
  }
  return prisma.dish.update({
    where: {
      id
    },
    data: {
      ...data,
      categoryId: data.categoryId ? Number(data.categoryId) : undefined
    },
    include: {
      category: true
    }
  })
}

export const deleteDish = async (id: number) => {
  // check coi món ăn này có trong menuItem nào ko
  const menuItems = await prisma.menuItem.findFirst({
    where: {
      dishId: id
    }
  })
  if (menuItems) {
    throw new Error('Món ăn này đang có trong menu, không thể xóa!')
  }
  // nếu đang có liên kết với nguyên liệu thì không cho xóa
  const dishIngredients = await prisma.dishIngredient.findFirst({
    where: {
      dishId: id
    }
  })
  if (dishIngredients) {
    throw new Error('Món ăn này đang có nguyên liệu liên kết, không thể xóa!')
  }
  return prisma.dish.delete({
    where: {
      id
    },
    include: {
      category: true
    }
  })
}

export const getIngredientDishList = async (dishId: number) => {
  const data = await prisma.dishIngredient.findMany({
    where: {
      dishId
    },
    include: {
      ingredient: true
    },
    orderBy: { createdAt: 'desc' }
  })
  return data
}

export const getDishIngredientDetail = (id: number) => {
  return prisma.dishIngredient.findUniqueOrThrow({
    where: { id },
    include: { ingredient: true }
  })
}

export const addIngredientToDish = async (body: AddIngredientToDishType) => {
  const { dishId, ingredientId, quantity, unit, isOptional = false, isMain = false } = body

  const dish = await prisma.dish.findUnique({ where: { id: dishId } })
  if (!dish) throw new Error('Món ăn không tồn tại')

  const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId } })
  if (!ingredient) throw new Error('Nguyên liệu không tồn tại')

  // upsert by unique compound (dishId, ingredientId)
  const created = await prisma.dishIngredient.upsert({
    where: { dishId_ingredientId: { dishId, ingredientId } },
    create: {
      dishId,
      ingredientId,
      quantity: String(quantity),
      unit: unit || null,
      isOptional,
      isMain
    },
    update: {
      // if exists, update values
      quantity: String(quantity),
      unit: unit || null,
      isOptional,
      isMain
    },
    include: { ingredient: true }
  })

  return created
}

export const updateIngredientToDish = async (id: number, body: UpdateIngredientInDishType) => {
  const exist = await prisma.dishIngredient.findUnique({ where: { id } })
  if (!exist) throw new Error('Liên kết nguyên liệu - món ăn không tồn tại')

  const { ingredientId, quantity, unit, isOptional = false, isMain = false } = body

  // if changing ingredient, ensure target ingredient exists and no duplicate on same dish
  if (ingredientId && ingredientId !== exist.ingredientId) {
    const newIng = await prisma.ingredient.findUnique({ where: { id: ingredientId } })
    if (!newIng) throw new Error('Nguyên liệu mới không tồn tại')

    const duplicate = await prisma.dishIngredient.findFirst({
      where: { dishId: exist.dishId, ingredientId }
    })
    if (duplicate) throw new Error('Nguyên liệu này đã được thêm cho món ăn')
  }

  const updated = await prisma.dishIngredient.update({
    where: { id },
    data: {
      ingredientId: ingredientId || undefined,
      quantity: quantity !== undefined ? String(quantity) : undefined,
      unit: unit !== undefined ? unit : undefined,
      isOptional,
      isMain
    },
    include: { ingredient: true }
  })

  return updated
}

export const deleteIngredientFromDish = async (id: number) => {
  const exist = await prisma.dishIngredient.findUnique({ where: { id }, include: { ingredient: true } })
  if (!exist) throw new Error('Liên kết nguyên liệu - món ăn không tồn tại')

  const deleted = await prisma.dishIngredient.delete({ where: { id }, include: { ingredient: true } })
  return deleted
}
