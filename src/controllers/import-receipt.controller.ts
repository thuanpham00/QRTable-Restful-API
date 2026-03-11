import prisma from '@/database'
import {
  ImportReceiptQueryType,
  CreateImportReceiptBodyType,
  UpdateImportReceiptBodyType
} from '@/schemaValidations/import-receipt.schema'

/**
 * Generate mã phiếu nhập tự động: IMP-YYYYMMDD-XXXX
 */
async function generateImportReceiptCode(tx: any): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

  const lastReceipt = await tx.importReceipt.findFirst({
    where: {
      code: {
        startsWith: `IMP-${dateStr}`
      }
    },
    orderBy: {
      code: 'desc'
    }
  })

  let sequence = 1
  if (lastReceipt) {
    const lastSequence = parseInt(lastReceipt.code.split('-')[2])
    sequence = lastSequence + 1
  }

  return `IMP-${dateStr}-${sequence.toString().padStart(4, '0')}`
}

export const getImportReceiptList = async ({
  page,
  limit,
  supplierId,
  status,
  fromDate,
  toDate
}: ImportReceiptQueryType) => {
  // Build where condition
  const where: any = {}

  if (supplierId) {
    where.supplierId = supplierId
  }

  if (status) {
    where.status = status
  }

  if (fromDate || toDate) {
    where.importDate = {}
    if (fromDate) {
      where.importDate.gte = fromDate
    }
    if (toDate) {
      where.importDate.lte = toDate
    }
  }

  // Query với pagination
  const [receipts, total] = await Promise.all([
    prisma.importReceipt.findMany({
      where,
      orderBy: { importDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: {
          include: {
            supplierIngredient: {
              include: {
                ingredient: {
                  select: {
                    name: true,
                    unit: true,
                    image: true
                  }
                },
                supplier: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        supplier: {
          select: {
            name: true
          }
        },
        createdByAccount: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.importReceipt.count({ where })
  ])

  // Map data để thêm thông tin
  const data = receipts.map((receipt) => ({
    id: receipt.id,
    code: receipt.code,
    supplierId: receipt.supplierId,
    importDate: receipt.importDate,
    totalAmount: receipt.totalAmount,
    status: receipt.status,
    note: receipt.note,
    createdBy: receipt.createdBy,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    supplierName: receipt.supplier.name,
    createdByName: receipt.createdByAccount.name,
    items: receipt.items.map((item) => ({
      id: item.id,
      importReceiptId: item.importReceiptId,
      supplierIngredientId: item.supplierIngredientId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      ingredientName: item.supplierIngredient.ingredient.name,
      ingredientUnit: item.supplierIngredient.ingredient.unit,
      ingredientImage: item.supplierIngredient.ingredient.image,
      supplierName: item.supplierIngredient.supplier.name
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

export const getImportReceiptDetail = async (id: number) => {
  const receipt = await prisma.importReceipt.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          supplierIngredient: {
            include: {
              ingredient: {
                select: {
                  name: true,
                  unit: true,
                  image: true
                }
              },
              supplier: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      },
      supplier: {
        select: {
          name: true
        }
      },
      createdByAccount: {
        select: {
          name: true
        }
      }
    }
  })

  if (!receipt) {
    return null
  }

  return {
    id: receipt.id,
    code: receipt.code,
    supplierId: receipt.supplierId,
    importDate: receipt.importDate,
    totalAmount: receipt.totalAmount,
    status: receipt.status,
    note: receipt.note,
    createdBy: receipt.createdBy,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    supplierName: receipt.supplier.name,
    createdByName: receipt.createdByAccount.name,
    items: receipt.items.map((item) => ({
      id: item.id,
      importReceiptId: item.importReceiptId,
      supplierIngredientId: item.supplierIngredientId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      ingredientName: item.supplierIngredient.ingredient.name,
      ingredientUnit: item.supplierIngredient.ingredient.unit,
      ingredientImage: item.supplierIngredient.ingredient.image,
      supplierName: item.supplierIngredient.supplier.name
    }))
  }
}

/**
 * Tạo phiếu nhập kho mới
 */
export const createImportReceipt = async (body: CreateImportReceiptBodyType, accountId: number) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Generate mã phiếu nhập tự động
    const code = await generateImportReceiptCode(tx)

    // 2. Chuẩn bị data cho items
    const itemsData = body.items.map((item) => ({
      supplierIngredientId: item.supplierIngredientId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.quantity * item.unitPrice,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      note: item.note
    }))

    // 3. Tính tổng tiền từ các items
    const totalAmount = itemsData.reduce((sum, item) => sum + item.totalPrice, 0)

    // 4. Tạo phiếu nhập và các items
    const receipt = await tx.importReceipt.create({
      data: {
        code,
        supplierId: body.supplierId,
        importDate: body.importDate || new Date(),
        totalAmount,
        status: 'Draft',
        note: body.note,
        createdBy: accountId,
        items: {
          create: itemsData // tạo liên kết vì importReceiptId sẽ tự động gán vào items
        }
      },
      include: {
        items: {
          include: {
            supplierIngredient: {
              include: {
                ingredient: {
                  select: {
                    name: true,
                    unit: true,
                    image: true
                  }
                },
                supplier: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        supplier: {
          select: {
            name: true
          }
        },
        createdByAccount: {
          select: {
            name: true
          }
        }
      }
    })

    return {
      id: receipt.id,
      code: receipt.code,
      supplierId: receipt.supplierId,
      importDate: receipt.importDate,
      totalAmount: receipt.totalAmount,
      status: receipt.status,
      note: receipt.note,
      createdBy: receipt.createdBy,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
      supplierName: receipt.supplier.name,
      createdByName: receipt.createdByAccount.name,
      items: receipt.items.map((item) => ({
        id: item.id,
        importReceiptId: item.importReceiptId,
        supplierIngredientId: item.supplierIngredientId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        ingredientName: item.supplierIngredient.ingredient.name,
        ingredientUnit: item.supplierIngredient.ingredient.unit,
        ingredientImage: item.supplierIngredient.ingredient.image,
        supplierName: item.supplierIngredient.supplier.name
      }))
    }
  })
}

/**
 * Cập nhật phiếu nhập kho
 */
export const updateImportReceipt = async (id: number, body: UpdateImportReceiptBodyType) => {
  return await prisma.$transaction(async (tx) => {
    // Kiểm tra phiếu nhập có tồn tại không
    const existingReceipt = await tx.importReceipt.findUnique({
      where: { id }
    })

    if (!existingReceipt) {
      throw new Error('Không tìm thấy phiếu nhập')
    }

    // Chỉ cho phép update nếu status = Draft
    if (existingReceipt.status === 'Completed') {
      throw new Error('Không thể sửa phiếu nhập đã hoàn thành')
    }

    if (existingReceipt.status === 'Cancelled') {
      throw new Error('Không thể sửa phiếu nhập đã hủy')
    }

    // Build update data
    const updateData: any = {}

    if (body.supplierId !== undefined) {
      updateData.supplierId = body.supplierId
    }

    if (body.importDate !== undefined) {
      updateData.importDate = body.importDate
    }

    if (body.status !== undefined) {
      updateData.status = body.status

      // Nếu chuyển sang Completed → Cập nhật inventory
      if (body.status === 'Completed' && existingReceipt.status === 'Draft') {
        // Lấy items của phiếu nhập
        const items = await tx.importReceiptItem.findMany({
          where: { importReceiptId: id },
          include: {
            supplierIngredient: {
              include: {
                ingredient: true
              }
            }
          }
        })

        // Cập nhật InventoryStock và tạo InventoryBatch
        for (const item of items) {
          const ingredientId = item.supplierIngredient.ingredientId

          // Tìm hoặc tạo InventoryStock
          let stock = await tx.inventoryStock.findUnique({
            where: { ingredientId }
          })

          if (!stock) {
            stock = await tx.inventoryStock.create({
              data: {
                ingredientId,
                quantity: 0,
                avgUnitPrice: 0,
                totalValue: 0
              }
            })
          }

          // Tính toán giá trị mới
          const newQuantity = stock.quantity + item.quantity
          const newTotalValue = stock.totalValue + item.totalPrice
          const newAvgUnitPrice = newQuantity > 0 ? newTotalValue / newQuantity : 0

          // Update InventoryStock
          await tx.inventoryStock.update({
            where: { ingredientId },
            data: {
              quantity: newQuantity,
              avgUnitPrice: newAvgUnitPrice,
              totalValue: newTotalValue,
              lastImport: new Date()
            }
          })

          // Tạo InventoryBatch
          await tx.inventoryBatch.create({
            data: {
              inventoryStockId: stock.id,
              batchNumber: item.batchNumber || `BATCH-${Date.now()}`,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              status: 'Available',
              importDate: existingReceipt.importDate,
              expiryDate: item.expiryDate
            }
          })
        }
      }
    }

    if (body.note !== undefined) {
      updateData.note = body.note
    }

    // Update items nếu có
    if (body.items) {
      // Xóa items cũ
      await tx.importReceiptItem.deleteMany({
        where: { importReceiptId: id }
      })

      // Tạo items mới
      await tx.importReceiptItem.createMany({
        data: body.items.map((item) => ({
          importReceiptId: id,
          supplierIngredientId: item.supplierIngredientId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          note: item.note
        }))
      })

      // Recalculate totalAmount
      const totalAmount = body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      updateData.totalAmount = totalAmount
    }

    // Update receipt
    const updatedReceipt = await tx.importReceipt.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            supplierIngredient: {
              include: {
                ingredient: {
                  select: {
                    name: true,
                    unit: true,
                    image: true
                  }
                },
                supplier: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        supplier: {
          select: {
            name: true
          }
        },
        createdByAccount: {
          select: {
            name: true
          }
        }
      }
    })

    return {
      id: updatedReceipt.id,
      code: updatedReceipt.code,
      supplierId: updatedReceipt.supplierId,
      importDate: updatedReceipt.importDate,
      totalAmount: updatedReceipt.totalAmount,
      status: updatedReceipt.status,
      note: updatedReceipt.note,
      createdBy: updatedReceipt.createdBy,
      createdAt: updatedReceipt.createdAt,
      updatedAt: updatedReceipt.updatedAt,
      supplierName: updatedReceipt.supplier.name,
      createdByName: updatedReceipt.createdByAccount.name,
      items: updatedReceipt.items.map((item) => ({
        id: item.id,
        importReceiptId: item.importReceiptId,
        supplierIngredientId: item.supplierIngredientId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        ingredientName: item.supplierIngredient.ingredient.name,
        ingredientUnit: item.supplierIngredient.ingredient.unit,
        ingredientImage: item.supplierIngredient.ingredient.image,
        supplierName: item.supplierIngredient.supplier.name
      }))
    }
  })
}

/**
 * Xóa phiếu nhập kho
 */
export const deleteImportReceipt = async (id: number) => {
  return await prisma.$transaction(async (tx) => {
    // Kiểm tra phiếu nhập có tồn tại không
    const receipt = await tx.importReceipt.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            supplierIngredient: {
              include: {
                ingredient: true
              }
            }
          }
        }
      }
    })

    if (!receipt) {
      throw new Error('Không tìm thấy phiếu nhập')
    }

    // Chỉ cho phép xóa nếu status = Draft
    if (receipt.status === 'Completed') {
      throw new Error('Không thể xóa phiếu nhập đã hoàn thành. Hãy hủy phiếu nhập trước.')
    }

    // Delete receipt (cascade sẽ xóa items)
    await tx.importReceipt.delete({
      where: { id }
    })
  })
}
