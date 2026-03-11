import { Prisma } from '@prisma/client'
import { calculateBatchStatus } from './inventory-batch.utils'

/**
 * Xuất nguyên liệu theo FIFO (First In First Out)
 *
 * @param tx - Prisma transaction client
 * @param exportReceiptId - ID của phiếu xuất
 * @param ingredientId - ID nguyên liệu cần xuất
 * @param quantityNeeded - Số lượng cần xuất (theo đơn vị của ingredient)
 * @returns Array of ExportReceiptItem đã tạo
 */
export async function exportIngredientFIFO(
  tx: Prisma.TransactionClient,
  exportReceiptId: number,
  ingredientId: number,
  quantityNeeded: number
) {
  // 1. Lấy InventoryStock
  const inventoryStock = await tx.inventoryStock.findFirst({
    where: { ingredientId },
    include: { ingredient: true }
  })

  if (!inventoryStock) {
    throw new Error(`Không tìm thấy tồn kho cho nguyên liệu ID ${ingredientId}`)
  }

  // 2. Validate đủ tồn kho
  if (inventoryStock.quantity < quantityNeeded) {
    throw new Error(
      `Không đủ tồn kho cho ${inventoryStock.ingredient.name}. ` +
        `Cần: ${quantityNeeded} ${inventoryStock.ingredient.unit}, ` +
        `Có: ${inventoryStock.quantity} ${inventoryStock.ingredient.unit}`
    )
  }

  // 3. Lấy các lô hàng theo FIFO (importDate ASC, chỉ lấy lô còn hàng)
  const batches = await tx.inventoryBatch.findMany({
    where: {
      inventoryStockId: inventoryStock.id,
      quantity: { gt: 0 },
      status: { notIn: ['Empty', 'Expired'] } // Không xuất từ lô Empty hoặc Expired
    },
    orderBy: {
      importDate: 'asc' // FIFO
    }
  })

  if (batches.length === 0) {
    throw new Error(`Không có lô hàng khả dụng cho ${inventoryStock.ingredient.name}`)
  }

  // 4. Xuất từng lô cho đến khi đủ
  let remainingQty = quantityNeeded
  let totalExportValue = 0

  for (const batch of batches) {
    if (remainingQty <= 0) break

    // Số lượng xuất từ lô này
    const exportFromBatch = Math.min(remainingQty, batch.quantity) // sd 500 - tồn 300

    // 5. Tạo ExportReceiptItem
    const exportItem = await tx.exportReceiptItem.create({
      data: {
        exportReceiptId,
        ingredientId,
        quantity: exportFromBatch,
        unitPrice: batch.unitPrice,
        totalPrice: exportFromBatch * batch.unitPrice,
        batchNumber: batch.batchNumber,
        note: `Xuất từ lô ${batch.batchNumber}`
      }
    })
    totalExportValue += exportItem.totalPrice

    // 6. Cập nhật InventoryBatch
    const newBatchQuantity = batch.quantity - exportFromBatch
    const newBatchStatus = calculateBatchStatus(newBatchQuantity, batch.expiryDate, 10) // lowThreshold

    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: {
        quantity: newBatchQuantity,
        status: newBatchStatus
      }
    })

    remainingQty -= exportFromBatch
  }

  // 7. Cập nhật InventoryStock
  const newStockQuantity = inventoryStock.quantity - quantityNeeded

  // Tính lại avgUnitPrice và totalValue
  const newTotalValue = inventoryStock.totalValue - totalExportValue
  const newAvgUnitPrice = newStockQuantity > 0 ? newTotalValue / newStockQuantity : inventoryStock.avgUnitPrice

  await tx.inventoryStock.update({
    where: { id: inventoryStock.id },
    data: {
      quantity: newStockQuantity,
      totalValue: newTotalValue,
      avgUnitPrice: newAvgUnitPrice,
      lastExport: new Date()
    }
  })

  return {
    totalValue: totalExportValue
  }
}

/**
 * Generate mã phiếu xuất kho unique
 * Format: EXP-YYYYMMDD-XXXX (VD: EXP-20260311-0001)
 */
export async function generateExportReceiptCode(tx: Prisma.TransactionClient): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const prefix = `EXP-${dateStr}-`

  // Tìm số thứ tự lớn nhất trong ngày
  const lastReceipt = await tx.exportReceipt.findFirst({
    where: {
      code: { startsWith: prefix }
    },
    orderBy: {
      code: 'desc'
    }
  })

  let sequence = 1
  if (lastReceipt) {
    const lastSequence = parseInt(lastReceipt.code.split('-')[2] || '0')
    sequence = lastSequence + 1
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`
}
