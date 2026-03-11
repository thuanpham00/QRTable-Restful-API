import prisma from '@/database'
import {
  CreateIngredientBodyType,
  IngredientQueryType,
  UpdateIngredientBodyType
} from '@/schemaValidations/ingredient.schema'

export const getIngredientList = async ({ page, limit, name, category, pagination, unit }: IngredientQueryType) => {
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

  let ingredients = await prisma.ingredient.findMany({
    orderBy: { createdAt: 'desc' }
  })

  if (name) {
    const lowerName = name.toLowerCase()
    ingredients = ingredients.filter((ing) => ing.name.toLowerCase().includes(lowerName))
  }

  if (category) {
    ingredients = ingredients.filter((ing) => ing.category === category)
  }

  if (unit) {
    ingredients = ingredients.filter((ing) => ing.unit === unit)
  }

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

  const total = ingredients.length
  const skip = (page - 1) * limit
  const paginatedData = data.slice(skip, skip + limit)

  return {
    data: paginatedData,
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

export const createIngredient = async (data: CreateIngredientBodyType) => {
  // Tạo ingredient và inventoryStock trong 1 transaction
  return prisma.$transaction(async (tx) => {
    // 1. Tạo ingredient
    const ingredient = await tx.ingredient.create({
      data: {
        name: data.name,
        description: data.description,
        allergenType: data.allergenType,
        isVegetarian: data.isVegetarian,
        isVegan: data.isVegan,
        category: data.category,
        isActive: data.isActive ?? false,
        image: data.image,
        unit: data.unit
      }
    })

    // 2. Tạo inventoryStock tương ứng
    await tx.inventoryStock.create({
      data: {
        ingredientId: ingredient.id,
        quantity: 0, // Khởi tạo = 0
        minStock: null,
        maxStock: null,
        avgUnitPrice: 0,
        totalValue: 0
      }
    })

    return ingredient
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
  // Kiểm tra ingredient có tồn tại không
  const ingredient = await prisma.ingredient.findUniqueOrThrow({
    where: { id },
    include: {
      inventoryStock: {
        include: {
          batches: true
        }
      }
    }
  })

  // Kiểm tra 1: Ingredient có đang được sử dụng trong món không
  const used = await prisma.dishIngredient.findFirst({ where: { ingredientId: id } })
  if (used) {
    throw new Error('Nguyên liệu đang được sử dụng trong món, không thể xóa!')
  }

  // Kiểm tra 2: Còn hàng tồn kho không
  if (ingredient.inventoryStock && ingredient.inventoryStock.quantity > 0) {
    throw new Error(
      `Không thể xóa nguyên liệu vì còn ${ingredient.inventoryStock.quantity} trong kho. ` +
        `Vui lòng xuất hết hàng hoặc điều chỉnh tồn kho về 0.`
    )
  }

  // Kiểm tra 3: Còn lô hàng không
  if (ingredient.inventoryStock && ingredient.inventoryStock.batches.length > 0) {
    throw new Error(`Không thể xóa nguyên liệu vì còn ${ingredient.inventoryStock.batches.length} lô hàng trong kho.`)
  }

  // Xóa ingredient → xóa theo inventoryStock
  return prisma.ingredient.delete({ where: { id } })
}
