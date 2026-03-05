import prisma from '@/database'
import {
  CreateIngredientBodyType,
  IngredientQueryType,
  UpdateIngredientBodyType
} from '@/schemaValidations/ingredient.schema'

export const getIngredientList = async ({ page, limit, name, category, pagination }: IngredientQueryType) => {
  if (pagination === 'false') {
    const ingredients = await prisma.ingredient.findMany({ orderBy: { createdAt: 'desc' } })
    // compute usage counts
    const ids = ingredients.map((i) => i.id)
    const counts = ids.length
      ? await prisma.dishIngredient.groupBy({
          by: ['ingredientId'],
          where: { ingredientId: { in: ids } },
          _count: { _all: true }
        })
      : []
    const countMap = new Map()
    counts.forEach((c) => countMap.set(c.ingredientId, c._count?._all ?? 0))

    const data = ingredients.map((ing) => ({
      ...ing,
      isActive: (ing as any).isActive ?? true,
      countDishUsed: countMap.get(ing.id) ?? 0
    }))

    return { data, pagination: null }
  }

  const skip = (page - 1) * limit

  const whereCondition = name ? { name: { contains: name } } : {}
  const whereCondition2 = category ? { category: category } : {}

  const [ingredients, total] = await Promise.all([
    prisma.ingredient.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      where: { ...whereCondition, ...whereCondition2 }
    }),
    prisma.ingredient.count({ where: { ...whereCondition, ...whereCondition2 } })
  ])
  // compute usage counts for current page items
  const ids = ingredients.map((i) => i.id)
  const counts = ids.length
    ? await prisma.dishIngredient.groupBy({
        by: ['ingredientId'],
        where: { ingredientId: { in: ids } },
        _count: { _all: true }
      })
    : []
  const countMap = new Map()
  counts.forEach((c) => countMap.set(c.ingredientId, c._count?._all ?? 0))

  const data = ingredients.map((ing) => ({
    ...ing,
    isActive: (ing as any).isActive ?? true,
    countDishUsed: countMap.get(ing.id) ?? 0
  }))

  return {
    data: data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

export const getIngredientDetail = (id: number) => {
  return prisma.ingredient
    .findUniqueOrThrow({
      where: { id },
      include: { dishIngredients: { include: { dish: true } } }
    })
    .then(async (ing) => {
      const count = await prisma.dishIngredient.count({ where: { ingredientId: id } })
      return {
        ...ing,
        isActive: (ing as any).isActive ?? true,
        countDishUsed: count
      }
    })
}

export const createIngredient = (data: CreateIngredientBodyType) => {
  return prisma.ingredient.create({
    data: {
      name: data.name,
      description: data.description,
      allergenType: data.allergenType,
      isVegetarian: data.isVegetarian,
      isVegan: data.isVegan,
      category: data.category,
      isActive: data.isActive ?? false,
      image: data.image
    }
  })
}

export const updateIngredient = (id: number, data: UpdateIngredientBodyType) => {
  return prisma.ingredient.update({
    where: { id },
    data: {
      ...data
    }
  })
}

export const deleteIngredient = async (id: number) => {
  // Prevent deleting if ingredient is used in any dish
  const used = await prisma.dishIngredient.findFirst({ where: { ingredientId: id } })
  if (used) {
    throw new Error('Nguyên liệu đang được sử dụng trong món, không thể xóa!')
  }
  return prisma.ingredient.delete({ where: { id } })
}
