import prisma from '@/database'
import { InventoryStockQueryType, UpdateInventoryStockBodyType } from '@/schemaValidations/inventory-stock.schema'

export const getInventoryStockList = async ({ page, limit, ingredientName, lowStock }: InventoryStockQueryType) => {
  // Lấy tất cả stocks (sẽ filter sau)
  const allStocks = await prisma.inventoryStock.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      ingredient: {
        select: {
          name: true,
          category: true,
          image: true,
          unit: true
        }
      },
      _count: {
        select: { batches: true }
      }
    }
  })

  // Map data để thêm thông tin ingredient
  let stocksWithInfo = allStocks.map((stock) => ({
    id: stock.id,
    ingredientId: stock.ingredientId,
    quantity: stock.quantity,
    minStock: stock.minStock,
    maxStock: stock.maxStock,
    avgUnitPrice: stock.avgUnitPrice,
    totalValue: stock.totalValue,
    lastImport: stock.lastImport,
    lastExport: stock.lastExport,
    updatedAt: stock.updatedAt,
    ingredientName: stock.ingredient.name,
    ingredientCategory: stock.ingredient.category,
    ingredientUnit: stock.ingredient.unit,
    ingredientImage: stock.ingredient.image,
    batchCount: stock._count.batches
  }))

  // Filter theo ingredientName (case-insensitive)
  if (ingredientName) {
    const searchLower = ingredientName.toLowerCase()
    stocksWithInfo = stocksWithInfo.filter((stock) => stock.ingredientName.toLowerCase().includes(searchLower))
  }

  // Filter lowStock nếu cần (quantity < minStock)
  if (lowStock === 'true') {
    stocksWithInfo = stocksWithInfo.filter((stock) => stock.minStock !== null && stock.quantity < stock.minStock)
  }

  // Pagination
  const total = stocksWithInfo.length
  const skip = (page - 1) * limit
  const paginatedData = stocksWithInfo.slice(skip, skip + limit)

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

export const getInventoryStockListNoPagination = async () => {
  const allStocks = await prisma.inventoryStock.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      ingredient: {
        select: {
          name: true,
          category: true,
          image: true
        }
      },
      _count: {
        select: { batches: true }
      }
    }
  })

  // Map data để thêm thông tin ingredient
  const stocksWithInfo = allStocks.map((stock) => ({
    id: stock.id,
    ingredientId: stock.ingredientId,
    quantity: stock.quantity,
    minStock: stock.minStock,
    maxStock: stock.maxStock,
    avgUnitPrice: stock.avgUnitPrice,
    totalValue: stock.totalValue,
    lastImport: stock.lastImport,
    lastExport: stock.lastExport,
    updatedAt: stock.updatedAt,
    ingredientName: stock.ingredient.name,
    ingredientCategory: stock.ingredient.category,
    ingredientImage: stock.ingredient.image,
    batchCount: stock._count.batches
  }))

  return {
    data: stocksWithInfo
  }
}

export const getInventoryStockDetail = async (id: number) => {
  const stock = await prisma.inventoryStock.findUniqueOrThrow({
    where: {
      id
    },
    include: {
      ingredient: {
        select: {
          name: true,
          category: true,
          image: true
        }
      },
      batches: {
        orderBy: {
          importDate: 'asc' // FIFO: First In First Out
        }
      },
      _count: {
        select: { batches: true }
      }
    }
  })

  return {
    id: stock.id,
    ingredientId: stock.ingredientId,
    quantity: stock.quantity,
    minStock: stock.minStock,
    maxStock: stock.maxStock,
    avgUnitPrice: stock.avgUnitPrice,
    totalValue: stock.totalValue,
    lastImport: stock.lastImport,
    lastExport: stock.lastExport,
    updatedAt: stock.updatedAt,
    ingredientName: stock.ingredient.name,
    ingredientCategory: stock.ingredient.category,
    ingredientImage: stock.ingredient.image,
    batchCount: stock._count.batches,
    batches: stock.batches
  }
}

export const updateInventoryStock = async (id: number, data: UpdateInventoryStockBodyType) => {
  // Kiểm tra tồn tại
  await prisma.inventoryStock.findUniqueOrThrow({
    where: { id }
  })

  // Chỉ cho phép update minStock và maxStock (ngưỡng cảnh báo)
  return prisma.inventoryStock.update({
    where: { id },
    data: {
      minStock: data.minStock,
      maxStock: data.maxStock
    }
  })
}
