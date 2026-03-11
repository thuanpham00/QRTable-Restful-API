import prisma from '@/database'
import { calculateBatchStatus } from '@/utils/inventory-batch.utils'

export const getListInventoryBatchesByStockId = async (inventoryStockId: number) => {
  const batches = await prisma.inventoryBatch.findMany({
    where: {
      inventoryStockId
    },
    include: {
      inventoryStock: {
        include: {
          ingredient: true
        }
      }
    },
    orderBy: {
      importDate: 'asc' // FIFO: Lô nhập trước xuất trước
    }
  })
  return batches
}

/**
 * Cập nhật status cho TẤT CẢ lô hàng trong hệ thống
 */
export const updateAllBatchStatus = async () => {
  const batches = await prisma.inventoryBatch.findMany()

  let updatedCount = 0

  for (const batch of batches) {
    const newStatus = calculateBatchStatus(batch.quantity, batch.expiryDate)

    if (batch.status !== newStatus) {
      await prisma.inventoryBatch.update({
        where: { id: batch.id },
        data: { status: newStatus }
      })
      updatedCount++
    }
  }

  return {
    total: batches.length,
    updated: updatedCount
  }
}
