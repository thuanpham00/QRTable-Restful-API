/**
 * Script random quantity cho InventoryStock và update InventoryBatch tương ứng
 * 
 * Logic:
 * 1. Random quantity trong khoảng [minStock, 100]
 * 2. Phân bổ quantity cho các batches theo tỷ lệ
 * 3. Update totalValue, avgUnitPrice
 * 4. Update batch status
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Helper: Random số trong khoảng [min, max]
function randomInRange(min, max) {
  return Math.random() * (max - min) + min
}

// Helper: Round to 2 decimal places
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

async function randomizeInventoryStock() {
  console.log('🎲 Bắt đầu random quantity cho InventoryStock...\n')
  console.log('📋 Logic:')
  console.log('   - Random quantity: [minStock, 100]')
  console.log('   - Phân bổ cho batches theo tỷ lệ')
  console.log('   - Update totalValue, status\n')
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

    let updatedCount = 0
    let skippedCount = 0

    for (const stock of stocks) {
      await prisma.$transaction(async (tx) => {
        const ingredient = stock.ingredient

        // Nếu không có batch thì skip
        if (stock.batches.length === 0) {
          console.log(`⏭️  ${ingredient.name}: Không có batch, bỏ qua`)
          skippedCount++
          return
        }

        // Xác định khoảng random
        const minQty = stock.minStock !== null && stock.minStock > 0 ? stock.minStock : 1
        const maxQty = 100

        // Random quantity mới
        const oldQuantity = stock.quantity
        const newQuantity = round2(randomInRange(minQty, maxQty))

        console.log(`\n🔧 ${ingredient.name} (${ingredient.unit}):`)
        console.log(`   Quantity: ${oldQuantity} → ${newQuantity}`)
        console.log(`   Batches: ${stock.batches.length}`)

        // Tính tỷ lệ thay đổi
        const ratio = oldQuantity > 0 ? newQuantity / oldQuantity : 1

        // Update từng batch theo tỷ lệ
        let totalBatchValue = 0
        const batchUpdates = []

        for (const batch of stock.batches) {
          const oldBatchQty = batch.quantity
          let newBatchQty

          if (oldQuantity > 0) {
            // Phân bổ theo tỷ lệ
            newBatchQty = round2(oldBatchQty * ratio)
          } else {
            // Nếu stock cũ = 0, phân đều cho các batches
            newBatchQty = round2(newQuantity / stock.batches.length)
          }

          // Tính toán status mới
          const newStatus = calculateBatchStatus(
            newBatchQty,
            batch.expiryDate,
            10 // lowThreshold
          )

          // Update batch
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              quantity: newBatchQty,
              status: newStatus
            }
          })

          totalBatchValue += newBatchQty * batch.unitPrice
          batchUpdates.push({
            batchNumber: batch.batchNumber,
            oldQty: oldBatchQty,
            newQty: newBatchQty,
            status: newStatus
          })
        }

        // Điều chỉnh để tổng batch quantity = stock quantity (xử lý làm tròn)
        const totalBatchQty = batchUpdates.reduce((sum, b) => sum + b.newQty, 0)
        const diff = round2(newQuantity - totalBatchQty)

        if (Math.abs(diff) > 0.01 && stock.batches.length > 0) {
          // Bù vào batch đầu tiên (FIFO)
          const firstBatch = stock.batches[0]
          const adjustedQty = round2(batchUpdates[0].newQty + diff)

          await tx.inventoryBatch.update({
            where: { id: firstBatch.id },
            data: {
              quantity: adjustedQty,
              status: calculateBatchStatus(adjustedQty, firstBatch.expiryDate, 10)
            }
          })

          batchUpdates[0].newQty = adjustedQty
          totalBatchValue = stock.batches.reduce((sum, batch, idx) => {
            return sum + batchUpdates[idx].newQty * batch.unitPrice
          }, 0)

          console.log(`   ⚖️  Điều chỉnh batch #1: +${diff} ${ingredient.unit}`)
        }

        // Tính avgUnitPrice và totalValue mới
        const newAvgUnitPrice = newQuantity > 0 ? totalBatchValue / newQuantity : stock.avgUnitPrice
        const newTotalValue = totalBatchValue

        // Update InventoryStock
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            quantity: newQuantity,
            avgUnitPrice: newAvgUnitPrice,
            totalValue: newTotalValue
          }
        })

        // Log chi tiết
        console.log(`   AvgPrice: ${stock.avgUnitPrice.toLocaleString('vi-VN')} → ${newAvgUnitPrice.toLocaleString('vi-VN')} đ/${ingredient.unit}`)
        console.log(`   TotalValue: ${stock.totalValue.toLocaleString('vi-VN')} → ${newTotalValue.toLocaleString('vi-VN')} đ`)
        console.log(`   Batch details:`)
        batchUpdates.forEach((b, idx) => {
          console.log(`      [${idx + 1}] ${b.batchNumber}: ${b.oldQty} → ${b.newQty} ${ingredient.unit} (${b.status})`)
        })

        updatedCount++
      })
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n📊 TÓM TẮT:`)
    console.log(`   - Tổng số tồn kho: ${stocks.length}`)
    console.log(`   - Đã random: ${updatedCount}`)
    console.log(`   - Bỏ qua (không có batch): ${skippedCount}`)
    console.log(`\n✅ Hoàn tất!`)

  } catch (error) {
    console.error('\n❌ LỖI:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

console.log('⚠️  CẢNH BÁO: Script này sẽ THAY ĐỔI dữ liệu quantity!')
console.log('💡 Chỉ dùng cho mục đích testing/demo')
console.log('\nĐang chạy trong 3 giây...\n')

setTimeout(() => {
  randomizeInventoryStock()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}, 3000)
