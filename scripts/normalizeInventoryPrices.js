/**
 * Script normalize giá giữa các InventoryBatch
 * Đảm bảo unitPrice giữa các lô không chênh lệch quá nhiều
 * Sau đó recalculate InventoryStock
 * 
 * Logic:
 * 1. Group batches theo ingredientId
 * 2. Tính avgPrice của tất cả batches
 * 3. Normalize giá: cho phép dao động ±15% so với giá TB
 * 4. Làm tròn số phù hợp với đơn vị
 * 5. Update InventoryStock
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Làm tròn theo quy tắc:
// - >= 1000: làm tròn đến 100
// - >= 100: làm tròn đến 10
// - >= 10: làm tròn đến 1
// - < 10: làm tròn đến 0.01
function smartRound(price) {
  if (price >= 1000000) {
    return Math.round(price / 1000) * 1000 // Làm tròn đến nghìn
  } else if (price >= 100000) {
    return Math.round(price / 100) * 100 // Làm tròn đến trăm
  } else if (price >= 1000) {
    return Math.round(price / 10) * 10 // Làm tròn đến chục
  } else if (price >= 100) {
    return Math.round(price) // Làm tròn đến đơn vị
  } else {
    return Math.round(price * 100) / 100 // Làm tròn đến 0.01
  }
}

function round2(num) {
  return Math.round(num * 100) / 100
}

async function normalizeInventoryPrices() {
  console.log('🔧 Normalize giá giữa các InventoryBatch...\n')
  console.log('='.repeat(80))
  console.log('📋 Quy tắc:')
  console.log('   - Tính giá TB của tất cả batches cùng nguyên liệu')
  console.log('   - Normalize: dao động ±15% so với giá TB')
  console.log('   - Làm tròn thông minh theo mức giá')
  console.log('   - Update InventoryStock tương ứng\n')
  console.log('='.repeat(80))

  try {
    const stocks = await prisma.inventoryStock.findMany({
      include: {
        ingredient: true,
        batches: {
          where: {
            quantity: { gt: 0 }
          },
          orderBy: { importDate: 'asc' }
        }
      }
    })

    console.log(`\n📦 Tìm thấy ${stocks.length} tồn kho\n`)

    let normalizedCount = 0
    let totalBatchesUpdated = 0

    for (const stock of stocks) {
      if (stock.batches.length === 0) {
        console.log(`⏭️  ${stock.ingredient.name}: Không có batch, bỏ qua`)
        continue
      }

      await prisma.$transaction(async (tx) => {
        const ingredient = stock.ingredient

        console.log(`\n📊 ${ingredient.name} (${ingredient.unit}):`)
        console.log(`   Batches: ${stock.batches.length}`)

        // Tính giá TB hiện tại (weighted average)
        const totalValue = stock.batches.reduce((sum, b) => sum + (b.quantity * b.unitPrice), 0)
        const totalQty = stock.batches.reduce((sum, b) => sum + b.quantity, 0)
        const currentAvgPrice = totalQty > 0 ? totalValue / totalQty : 0

        console.log(`   Giá TB hiện tại: ${smartRound(currentAvgPrice).toLocaleString('vi-VN')}đ/${ingredient.unit}`)

        // Normalize từng batch
        const batchUpdates = []
        let hasChanges = false

        for (const batch of stock.batches) {
          const oldPrice = batch.unitPrice
          let newPrice = oldPrice

          // Kiểm tra độ chênh lệch so với giá TB
          const deviation = Math.abs(oldPrice - currentAvgPrice) / currentAvgPrice

          if (deviation > 0.15) {
            // Nếu chênh lệch > 15%, kéo về gần giá TB hơn
            // Nhưng vẫn giữ một chút variation (±10%)
            const direction = oldPrice > currentAvgPrice ? 1 : -1
            const randomVariation = (Math.random() * 0.2 - 0.1) // -10% to +10%
            newPrice = currentAvgPrice * (1 + randomVariation)
            hasChanges = true
          }

          // Làm tròn
          newPrice = smartRound(newPrice)

          batchUpdates.push({
            id: batch.id,
            batchNumber: batch.batchNumber,
            quantity: batch.quantity,
            oldPrice,
            newPrice,
            changed: Math.abs(oldPrice - newPrice) > 0.01
          })

          if (Math.abs(oldPrice - newPrice) > 0.01) {
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: { unitPrice: newPrice }
            })
            totalBatchesUpdated++
          }
        }

        if (hasChanges) {
          normalizedCount++
        }

        // Recalculate InventoryStock từ batches mới
        const newTotalValue = batchUpdates.reduce((sum, b) => sum + (b.quantity * b.newPrice), 0)
        const newAvgPrice = totalQty > 0 ? newTotalValue / totalQty : 0

        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            quantity: round2(totalQty),
            avgUnitPrice: round2(newAvgPrice),
            totalValue: round2(newTotalValue)
          }
        })

        // Log chi tiết
        console.log(`   ✅ Updated Stock:`)
        console.log(`      Quantity: ${round2(totalQty)} ${ingredient.unit}`)
        console.log(`      AvgPrice: ${stock.avgUnitPrice.toLocaleString('vi-VN')} → ${round2(newAvgPrice).toLocaleString('vi-VN')}đ/${ingredient.unit}`)
        console.log(`      TotalValue: ${stock.totalValue.toLocaleString('vi-VN')} → ${round2(newTotalValue).toLocaleString('vi-VN')}đ`)

        console.log(`   📦 Batches:`)
        batchUpdates.forEach((b, idx) => {
          const status = b.changed ? '🔧' : '✓'
          const priceChange = b.changed ? ` (${b.oldPrice.toLocaleString('vi-VN')} → ${b.newPrice.toLocaleString('vi-VN')})` : ''
          console.log(`      [${idx + 1}] ${b.batchNumber}: ${b.quantity} × ${b.newPrice.toLocaleString('vi-VN')}đ${priceChange} ${status}`)
        })
      })
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n📊 TÓM TẮT:`)
    console.log(`   - Tổng số tồn kho: ${stocks.length}`)
    console.log(`   - Đã normalize: ${normalizedCount}`)
    console.log(`   - Tổng batches đã update: ${totalBatchesUpdated}`)
    console.log(`\n✅ Hoàn tất!`)

  } catch (error) {
    console.error('\n❌ LỖI:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

console.log('⚠️  Script này sẽ normalize giá giữa các batch!')
console.log('💡 Giá sẽ được điều chỉnh để không chênh lệch quá 15%')
console.log('\nĐang chạy trong 3 giây...\n')

setTimeout(() => {
  normalizeInventoryPrices()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}, 3000)
