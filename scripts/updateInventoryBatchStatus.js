/**
 * Script để cập nhật status cho tất cả InventoryBatch
 * 
 * Logic:
 * - Empty: quantity = 0
 * - Expired: expiryDate < now (đã hết hạn)
 * - Low: quantity > 0 nhưng < 10% số lượng ban đầu hoặc < threshold
 * - Available: còn hàng, chưa hết hạn
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateInventoryBatchStatus() {
  console.log('🔄 Bắt đầu cập nhật status cho InventoryBatch...')

  try {
    // Lấy tất cả batches
    const batches = await prisma.inventoryBatch.findMany()

    console.log(`📦 Tìm thấy ${batches.length} lô hàng`)

    let updatedCount = 0
    const now = new Date()

    for (const batch of batches) {
      let newStatus = 'Available'

      // Logic xác định status
      if (batch.quantity === 0) {
        newStatus = 'Empty'
      } else if (batch.expiryDate && batch.expiryDate < now) {
        newStatus = 'Expired'
      } else if (batch.quantity > 0 && batch.quantity < 10) {
        // Coi là Low nếu còn dưới 10 đơn vị
        newStatus = 'Low'
      } else {
        newStatus = 'Available'
      }

      // Update nếu status khác với hiện tại
      if (batch.status !== newStatus) {
        await prisma.inventoryBatch.update({
          where: { id: batch.id },
          data: { status: newStatus }
        })

        updatedCount++
        console.log(
          `✅ Batch #${batch.id} (${batch.batchNumber}): ${batch.status || 'NULL'} → ${newStatus} (qty: ${batch.quantity})`
        )
      }
    }

    console.log(`\n✨ Hoàn thành! Đã cập nhật ${updatedCount}/${batches.length} lô hàng`)

    // Thống kê sau khi update
    const stats = await prisma.inventoryBatch.groupBy({
      by: ['status'],
      _count: { status: true }
    })

    console.log('\n📊 Thống kê trạng thái lô hàng:')
    stats.forEach(stat => {
      console.log(`   ${stat.status}: ${stat._count.status} lô`)
    })

  } catch (error) {
    console.error('❌ Lỗi:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Chạy script
updateInventoryBatchStatus()
  .then(() => {
    console.log('\n✅ Script hoàn thành!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script thất bại:', error)
    process.exit(1)
  })
