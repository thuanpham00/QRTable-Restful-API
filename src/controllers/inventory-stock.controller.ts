import prisma from '@/database'
import {
  CreateInventoryStockBodyType,
  InventoryStockQueryType,
  UpdateInventoryStockBodyType
} from '@/schemaValidations/inventory-stock.schema'

export const getInventoryStockList = async ({ page, limit, ingredientName, lowStock }: InventoryStockQueryType) => {
  // Lấy tất cả stocks (sẽ filter sau)
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
    ingredientImage: stock.ingredient.image,
    batchCount: stock._count.batches
  }))

  // Filter theo ingredientName (case-insensitive)
  if (ingredientName) {
    const searchLower = ingredientName.toLowerCase()
    stocksWithInfo = stocksWithInfo.filter((stock) => stock.ingredientName.toLowerCase().includes(searchLower))
  }

  // Filter lowStock nếu cần (quantity < minStock)
  if (lowStock) {
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

export const getInventoryStockDetail = async (id: number) => {
  const stock = await prisma.inventoryStock.findUniqueOrThrow({
    where: {
      id
    },
    include: {
      ingredient: {
        select: {
          name: true,
          category: true
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
    batchCount: stock._count.batches,
    batches: stock.batches
  }
}

export const createInventoryStock = async (data: CreateInventoryStockBodyType) => {
  // Kiểm tra ingredientId đã có InventoryStock chưa
  const existingStock = await prisma.inventoryStock.findUnique({
    where: {
      ingredientId: data.ingredientId
    }
  })

  if (existingStock) {
    throw new Error(`Nguyên liệu này đã có tồn kho (ID: ${existingStock.id})`)
  }

  // Kiểm tra ingredient có tồn tại không
  await prisma.ingredient.findUniqueOrThrow({
    where: {
      id: data.ingredientId
    }
  })

  return prisma.inventoryStock.create({
    data: {
      ingredientId: data.ingredientId,
      quantity: data.quantity || 0,
      minStock: data.minStock || null,
      maxStock: data.maxStock || null,
      avgUnitPrice: data.avgUnitPrice || 0,
      totalValue: data.totalValue || 0
    }
  })
}

export const updateInventoryStock = async (id: number, data: UpdateInventoryStockBodyType) => {
  // Kiểm tra tồn tại
  await prisma.inventoryStock.findUniqueOrThrow({
    where: { id }
  })

  return prisma.inventoryStock.update({
    where: {
      id
    },
    data
  })
}

export const deleteInventoryStock = async (id: number) => {
  // Kiểm tra có batches nào không
  const batchCount = await prisma.inventoryBatch.count({
    where: {
      inventoryStockId: id
    }
  })

  if (batchCount > 0) {
    throw new Error(`Không thể xóa tồn kho này vì còn ${batchCount} lô hàng`)
  }

  return prisma.inventoryStock.delete({
    where: {
      id
    }
  })
}
