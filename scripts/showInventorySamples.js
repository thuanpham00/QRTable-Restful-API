const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Script hiển thị mẫu dữ liệu để xác nhận đã làm tròn
 */

async function showSampleData() {
  try {
    console.log('📋 Hiển thị dữ liệu mẫu...\n')

    // ===== 1. Hiển thị 5 InventoryStock =====
    console.log('📦 InventoryStock (5 mẫu đầu):')
    console.log('─'.repeat(100))
    const stocks = await prisma.inventoryStock.findMany({
      take: 5,
      include: {
        ingredient: {
          select: { name: true }
        }
      }
    })

    stocks.forEach((stock) => {
      console.log(`ID: ${stock.id} | ${stock.ingredient.name}`)
      console.log(`  quantity: ${stock.quantity} | minStock: ${stock.minStock} | maxStock: ${stock.maxStock}`)
      console.log(`  avgUnitPrice: ${stock.avgUnitPrice} | totalValue: ${stock.totalValue}`)
      console.log(`  Đã làm tròn: ${Number.isInteger(stock.quantity) && Number.isInteger(stock.avgUnitPrice) && Number.isInteger(stock.totalValue) ? '✅' : '❌'}`)
      console.log('─'.repeat(100))
    })

    // ===== 2. Hiển thị 5 InventoryBatch =====
    console.log('\n📦 InventoryBatch (5 mẫu đầu):')
    console.log('─'.repeat(100))
    const batches = await prisma.inventoryBatch.findMany({
      take: 5,
      include: {
        inventoryStock: {
          include: {
            ingredient: {
              select: { name: true }
            }
          }
        }
      }
    })

    batches.forEach((batch) => {
      console.log(`ID: ${batch.id} | ${batch.inventoryStock.ingredient.name} | Batch: ${batch.batchNumber}`)
      console.log(`  quantity: ${batch.quantity} | unitPrice: ${batch.unitPrice}`)
      console.log(`  Đã làm tròn: ${Number.isInteger(batch.quantity) && Number.isInteger(batch.unitPrice) ? '✅' : '❌'}`)
      console.log('─'.repeat(100))
    })

  } catch (error) {
    console.error('❌ Lỗi:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Chạy script
showSampleData()
  .then(() => {
    console.log('\n✨ Hoàn thành!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Thất bại:', error)
    process.exit(1)
  })
