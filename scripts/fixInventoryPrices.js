/**
 * Script kiểm tra và fix unitPrice trong InventoryBatch
 * Sau đó recalculate InventoryStock (avgUnitPrice, totalValue)
 * 
 * Logic:
 * 1. Kiểm tra unitPrice có hợp lý không (sau khi convert đơn vị)
 * 2. Fix unitPrice nếu cần (×1000 cho kg/liter)
 * 3. Recalculate avgUnitPrice và totalValue từ các batches
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function round2(num) {
  return Math.round(num * 100) / 100
}

async function fixInventoryPrices() {
  console.log('🔍 Kiểm tra và fix giá trong InventoryBatch...\n')
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

    let fixedPriceCount = 0
    let recalculatedCount = 0

    for (const stock of stocks) {
      await prisma.$transaction(async (tx) => {
        const ingredient = stock.ingredient

        if (stock.batches.length === 0) {
          console.log(`⏭️  ${ingredient.name}: Không có batch, bỏ qua`)
          return
        }

        console.log(`\n📊 ${ingredient.name} (${ingredient.unit}):`)
        console.log(`   Current Stock - Qty: ${stock.quantity}, AvgPrice: ${stock.avgUnitPrice.toLocaleString('vi-VN')}đ/${ingredient.unit}, Total: ${stock.totalValue.toLocaleString('vi-VN')}đ`)

        // Check và fix unitPrice trong batches
        let needsPriceFix = false
        const batchDetails = []

        for (const batch of stock.batches) {
          let fixedPrice = batch.unitPrice
          let priceFixed = false

          // Kiểm tra nếu đơn vị là kg hoặc liter mà giá quá thấp
          // (có thể do convert đơn vị mà chưa convert giá)
          if ((ingredient.unit === 'kg' || ingredient.unit === 'liter') && batch.unitPrice < 1000) {
            fixedPrice = batch.unitPrice * 1000
            priceFixed = true
            needsPriceFix = true
          }

          batchDetails.push({
            id: batch.id,
            batchNumber: batch.batchNumber,
            quantity: batch.quantity,
            oldPrice: batch.unitPrice,
            newPrice: fixedPrice,
            priceFixed,
            totalValue: batch.quantity * fixedPrice
          })

          if (priceFixed) {
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: { unitPrice: fixedPrice }
            })
            console.log(`   🔧 Fixed batch ${batch.batchNumber}: ${batch.unitPrice.toLocaleString('vi-VN')} → ${fixedPrice.toLocaleString('vi-VN')}đ/${ingredient.unit}`)
          }
        }

        if (needsPriceFix) {
          fixedPriceCount++
        }

        // Recalculate InventoryStock từ batches
        const totalQuantity = batchDetails.reduce((sum, b) => sum + b.quantity, 0)
        const totalValue = batchDetails.reduce((sum, b) => sum + b.totalValue, 0)
        const avgUnitPrice = totalQuantity > 0 ? totalValue / totalQuantity : 0

        // Update InventoryStock
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            quantity: round2(totalQuantity),
            avgUnitPrice: round2(avgUnitPrice),
            totalValue: round2(totalValue)
          }
        })

        console.log(`   ✅ Recalculated Stock:`)
        console.log(`      Quantity: ${stock.quantity} → ${round2(totalQuantity)} ${ingredient.unit}`)
        console.log(`      AvgPrice: ${stock.avgUnitPrice.toLocaleString('vi-VN')} → ${round2(avgUnitPrice).toLocaleString('vi-VN')}đ/${ingredient.unit}`)
        console.log(`      TotalValue: ${stock.totalValue.toLocaleString('vi-VN')} → ${round2(totalValue).toLocaleString('vi-VN')}đ`)

        console.log(`   📦 Batches (${batchDetails.length}):`)
        batchDetails.forEach((b, idx) => {
          const status = b.priceFixed ? '🔧' : '✓'
          console.log(`      [${idx + 1}] ${b.batchNumber}: ${b.quantity} × ${b.newPrice.toLocaleString('vi-VN')}đ = ${b.totalValue.toLocaleString('vi-VN')}đ ${status}`)
        })

        recalculatedCount++
      })
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n📊 TÓM TẮT:`)
    console.log(`   - Tổng số tồn kho: ${stocks.length}`)
    console.log(`   - Đã fix giá batch: ${fixedPriceCount}`)
    console.log(`   - Đã recalculate: ${recalculatedCount}`)
    console.log(`\n✅ Hoàn tất!`)

  } catch (error) {
    console.error('\n❌ LỖI:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixInventoryPrices()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
