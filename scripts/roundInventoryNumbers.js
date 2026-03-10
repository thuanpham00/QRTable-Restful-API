const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Script làm tròn số lên cho các trường trong InventoryStock và InventoryBatch
 * - InventoryStock: quantity, minStock, maxStock, avgUnitPrice, totalValue
 * - InventoryBatch: quantity, unitPrice
 */

async function roundInventoryNumbers() {
  try {
    console.log('🔄 Bắt đầu làm tròn số liệu tồn kho...\n')

    // ===== 1. Xử lý InventoryStock =====
    console.log('📦 Xử lý InventoryStock...')
    const inventoryStocks = await prisma.inventoryStock.findMany({
      select: {
        id: true,
        quantity: true,
        minStock: true,
        maxStock: true,
        avgUnitPrice: true,
        totalValue: true
      }
    })

    console.log(`   Tìm thấy: ${inventoryStocks.length} bản ghi`)

    let stockUpdated = 0
    for (const stock of inventoryStocks) {
      const updates = {}
      let hasChanges = false

      // Làm tròn từng trường
      const roundedQuantity = Math.ceil(stock.quantity)
      if (roundedQuantity !== stock.quantity) {
        updates.quantity = roundedQuantity
        hasChanges = true
      }

      if (stock.minStock !== null) {
        const roundedMinStock = Math.ceil(stock.minStock)
        if (roundedMinStock !== stock.minStock) {
          updates.minStock = roundedMinStock
          hasChanges = true
        }
      }

      if (stock.maxStock !== null) {
        const roundedMaxStock = Math.ceil(stock.maxStock)
        if (roundedMaxStock !== stock.maxStock) {
          updates.maxStock = roundedMaxStock
          hasChanges = true
        }
      }

      const roundedAvgUnitPrice = Math.ceil(stock.avgUnitPrice)
      if (roundedAvgUnitPrice !== stock.avgUnitPrice) {
        updates.avgUnitPrice = roundedAvgUnitPrice
        hasChanges = true
      }

      const roundedTotalValue = Math.ceil(stock.totalValue)
      if (roundedTotalValue !== stock.totalValue) {
        updates.totalValue = roundedTotalValue
        hasChanges = true
      }

      // Chỉ update nếu có thay đổi
      if (hasChanges) {
        await prisma.inventoryStock.update({
          where: { id: stock.id },
          data: updates
        })
        stockUpdated++
        console.log(`   ✓ Stock ID ${stock.id}: ${Object.keys(updates).join(', ')}`)
      }
    }

    console.log(`   ✅ Đã cập nhật ${stockUpdated}/${inventoryStocks.length} InventoryStock\n`)

    // ===== 2. Xử lý InventoryBatch =====
    console.log('📦 Xử lý InventoryBatch...')
    const inventoryBatches = await prisma.inventoryBatch.findMany({
      select: {
        id: true,
        quantity: true,
        unitPrice: true
      }
    })

    console.log(`   Tìm thấy: ${inventoryBatches.length} bản ghi`)

    let batchUpdated = 0
    for (const batch of inventoryBatches) {
      const updates = {}
      let hasChanges = false

      // Làm tròn quantity
      const roundedQuantity = Math.ceil(batch.quantity)
      if (roundedQuantity !== batch.quantity) {
        updates.quantity = roundedQuantity
        hasChanges = true
      }

      // Làm tròn unitPrice
      const roundedUnitPrice = Math.ceil(batch.unitPrice)
      if (roundedUnitPrice !== batch.unitPrice) {
        updates.unitPrice = roundedUnitPrice
        hasChanges = true
      }

      // Chỉ update nếu có thay đổi
      if (hasChanges) {
        await prisma.inventoryBatch.update({
          where: { id: batch.id },
          data: updates
        })
        batchUpdated++
        console.log(`   ✓ Batch ID ${batch.id}: ${Object.keys(updates).join(', ')}`)
      }
    }

    console.log(`   ✅ Đã cập nhật ${batchUpdated}/${inventoryBatches.length} InventoryBatch\n`)

    // ===== Tổng kết =====
    console.log('📊 Tổng kết:')
    console.log(`   - InventoryStock cập nhật: ${stockUpdated}/${inventoryStocks.length}`)
    console.log(`   - InventoryBatch cập nhật: ${batchUpdated}/${inventoryBatches.length}`)
    console.log(`   - Tổng cộng: ${stockUpdated + batchUpdated} bản ghi\n`)

  } catch (error) {
    console.error('❌ Lỗi:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Chạy script
roundInventoryNumbers()
  .then(() => {
    console.log('✨ Hoàn thành!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Thất bại:', error)
    process.exit(1)
  })
