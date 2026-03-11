import prisma from '@/database'
import { ExportReceiptQueryType } from '@/schemaValidations/export-receipt.schema'

/**
 * Lấy danh sách phiếu xuất kho (có phân trang và filter)
 */
export const getExportReceiptList = async ({ page, limit, fromDate, toDate }: ExportReceiptQueryType) => {
  // Build where condition
  const where: any = {}

  if (fromDate || toDate) {
    where.exportDate = {}
    if (fromDate) {
      where.exportDate.gte = fromDate
    }
    if (toDate) {
      where.exportDate.lte = toDate
    }
  }

  // Query với pagination
  const [receipts, total] = await Promise.all([
    prisma.exportReceipt.findMany({
      where,
      orderBy: { exportDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: {
          include: {
            ingredient: {
              select: {
                name: true,
                unit: true,
                image: true
              }
            }
          }
        },
        createdByAccount: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.exportReceipt.count({ where })
  ])

  // Map data để thêm thông tin
  const data = receipts.map((receipt) => ({
    id: receipt.id,
    code: receipt.code,
    exportDate: receipt.exportDate,
    exportType: receipt.exportType,
    totalAmount: receipt.totalAmount,
    status: receipt.status,
    relatedOrderId: receipt.relatedOrderId,
    note: receipt.note,
    createdBy: receipt.createdBy,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    createdByName: receipt.createdByAccount.name,
    items: receipt.items.map((item) => ({
      id: item.id,
      exportReceiptId: item.exportReceiptId,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      batchNumber: item.batchNumber,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      ingredientName: item.ingredient.name,
      ingredientUnit: item.ingredient.unit,
      ingredientImage: item.ingredient.image
    }))
  }))

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

/**
 * Lấy chi tiết một phiếu xuất kho
 */
export const getExportReceiptDetail = async (id: number) => {
  const receipt = await prisma.exportReceipt.findUniqueOrThrow({
    where: { id },
    include: {
      items: {
        include: {
          ingredient: {
            select: {
              name: true,
              unit: true,
              image: true
            }
          }
        }
      },
      createdByAccount: {
        select: {
          name: true
        }
      },
      relatedOrder: {
        select: {
          id: true,
          status: true,
          quantity: true,
          dishSnapshot: {
            select: {
              name: true
            }
          }
        }
      }
    }
  })

  return {
    id: receipt.id,
    code: receipt.code,
    exportDate: receipt.exportDate,
    exportType: receipt.exportType,
    totalAmount: receipt.totalAmount,
    status: receipt.status,
    relatedOrderId: receipt.relatedOrderId,
    note: receipt.note,
    createdBy: receipt.createdBy,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    createdByName: receipt.createdByAccount.name,
    items: receipt.items.map((item) => ({
      id: item.id,
      exportReceiptId: item.exportReceiptId,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      batchNumber: item.batchNumber,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      ingredientName: item.ingredient.name,
      ingredientUnit: item.ingredient.unit,
      ingredientImage: item.ingredient.image
    }))
  }
}
