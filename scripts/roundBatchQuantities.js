/**
 * Script làm tròn quantity trong InventoryBatch và update InventoryStock
 * 
 * Logic:
 * 1. Làm tròn quantity trong mỗi batch (Math.round)
 * 2. Recalculate InventoryStock từ các batch đã làm tròn
 * 3. Update avgUnitPrice, totalValue
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function round2(num) {
  return Math.round(num * 100) / 100
}

// Calculate batch status
function calculateBatchStatus(quantity, expiryDate, lowThreshold = 10) {
  if (expiryDate && expiryDate < new Date()) {
    return 'Expired'
  }
  if (quantity === 0) {
    return 'Empty'
  }
  if (quantity < lowThreshold) {
    return 'Low'
  }
  return 'Available'
}

async function roundBatchQuantities() {
  console.log('🔄 Làm tròn quantity trong InventoryBatch...\n')
  console.log('='.repeat(80))

  try {
    const stocks = await prisma.inventoryStock.findMany({
      include: {
        ingredient: true,
        batches: {
          orderBy: { importDate: 'asc' }
        }
      }
    })

    console.log(`\n📦 Tìm thấy ${stocks.length} tồn kho\n`)

    let updatedStockCount = 0
    let updatedBatchCount = 0

    for (const stock of stocks) {
      await prisma.$transaction(async (tx) => {
        const ingredient = stock.ingredient

        if (stock.batches.length === 0) {
          console.log(`⏭️  ${ingredient.name}: Không có batch, bỏ qua`)
          return
        }

        console.log(`\n📊 ${ingredient.name} (${ingredient.unit}):`)
        console.log(`   Current Stock - Qty: ${stock.quantity}, AvgPrice: ${stock.avgUnitPrice.toLocaleString('vi-VN')}đ/${ingredient.unit}, Total: ${stock.totalValue.toLocaleString('vi-VN')}đ`)

        let totalQuantity = 0
        let totalValue = 0
        const batchUpdates = []

        // Process each batch
        for (const batch of stock.batches) {
          const oldQty = batch.quantity
          const roundedQty = Math.round(oldQty)

          // Nếu số lượng đã là số nguyên, giữ nguyên
          const newQty = roundedQty

          const batchValue = newQty * batch.unitPrice
          totalQuantity += newQty
          totalValue += batchValue

          // Calculate new status
          const newStatus = calculateBatchStatus(newQty, batch.expiryDate, 10)

          // Update batch
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              quantity: newQty,
              status: newStatus
            }
          })

          batchUpdates.push({
            batchNumber: batch.batchNumber,
            oldQty,
            newQty,
            unitPrice: batch.unitPrice,
            batchValue,
            status: newStatus,
            changed: oldQty !== newQty
          })

          if (oldQty !== newQty) {
            updatedBatchCount++
          }
        }

        // Calculate new stock values
        const avgUnitPrice = totalQuantity > 0 ? round2(totalValue / totalQuantity) : 0

        // Update InventoryStock
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            quantity: totalQuantity,
            avgUnitPrice: avgUnitPrice,
            totalValue: round2(totalValue)
          }
        })

        console.log(`   ✅ Updated Stock:`)
        console.log(`      Quantity: ${stock.quantity} → ${totalQuantity} ${ingredient.unit}`)
        console.log(`      AvgPrice: ${stock.avgUnitPrice.toLocaleString('vi-VN')} → ${avgUnitPrice.toLocaleString('vi-VN')}đ/${ingredient.unit}`)
        console.log(`      TotalValue: ${stock.totalValue.toLocaleString('vi-VN')} → ${round2(totalValue).toLocaleString('vi-VN')}đ`)

        console.log(`   📦 Batches (${batchUpdates.length}):`)
        batchUpdates.forEach((b, idx) => {
          const status = b.changed ? '🔄' : '✓'
          const qtyDisplay = b.changed ? `${b.oldQty} → ${b.newQty}` : `${b.newQty}`
          console.log(`      [${idx + 1}] ${b.batchNumber}: ${qtyDisplay} ${ingredient.unit} × ${b.unitPrice.toLocaleString('vi-VN')}đ = ${b.batchValue.toLocaleString('vi-VN')}đ (${b.status}) ${status}`)
        })

        updatedStockCount++
      })
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n📊 TÓM TẮT:`)
    console.log(`   - Tổng số tồn kho: ${stocks.length}`)
    console.log(`   - Đã cập nhật stock: ${updatedStockCount}`)
    console.log(`   - Đã làm tròn batch: ${updatedBatchCount}`)
    console.log(`\n✅ Hoàn tất!`)

  } catch (error) {
    console.error('\n❌ LỖI:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

roundBatchQuantities()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
