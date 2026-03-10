const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Script kiểm tra xem các trường số đã được làm tròn chưa
 */

async function verifyInventoryNumbers() {
  try {
    console.log('🔍 Kiểm tra số liệu tồn kho...\n')

    // ===== 1. Kiểm tra InventoryStock =====
    console.log('📦 Kiểm tra InventoryStock...')
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

    console.log(`   Tìm thấy: ${inventoryStocks.length} bản ghi\n`)

    let stockIssues = []
    for (const stock of inventoryStocks) {
      const issues = []

      // Kiểm tra từng trường xem có phải số nguyên không
      if (!Number.isInteger(stock.quantity)) {
        issues.push(`quantity=${stock.quantity}`)
      }

      if (stock.minStock !== null && !Number.isInteger(stock.minStock)) {
        issues.push(`minStock=${stock.minStock}`)
      }

      if (stock.maxStock !== null && !Number.isInteger(stock.maxStock)) {
        issues.push(`maxStock=${stock.maxStock}`)
      }

      if (!Number.isInteger(stock.avgUnitPrice)) {
        issues.push(`avgUnitPrice=${stock.avgUnitPrice}`)
      }

      if (!Number.isInteger(stock.totalValue)) {
        issues.push(`totalValue=${stock.totalValue}`)
      }

      if (issues.length > 0) {
        stockIssues.push({ id: stock.id, issues })
        console.log(`   ⚠️  Stock ID ${stock.id}: ${issues.join(', ')}`)
      }
    }

    if (stockIssues.length === 0) {
      console.log(`   ✅ Tất cả InventoryStock đã được làm tròn!`)
    } else {
      console.log(`   ❌ Có ${stockIssues.length}/${inventoryStocks.length} bản ghi chưa làm tròn`)
    }

    // ===== 2. Kiểm tra InventoryBatch =====
    console.log('\n📦 Kiểm tra InventoryBatch...')
    const inventoryBatches = await prisma.inventoryBatch.findMany({
      select: {
        id: true,
        quantity: true,
        unitPrice: true
      }
    })

    console.log(`   Tìm thấy: ${inventoryBatches.length} bản ghi\n`)

    let batchIssues = []
    for (const batch of inventoryBatches) {
      const issues = []

      if (!Number.isInteger(batch.quantity)) {
        issues.push(`quantity=${batch.quantity}`)
      }

      if (!Number.isInteger(batch.unitPrice)) {
        issues.push(`unitPrice=${batch.unitPrice}`)
      }

      if (issues.length > 0) {
        batchIssues.push({ id: batch.id, issues })
        console.log(`   ⚠️  Batch ID ${batch.id}: ${issues.join(', ')}`)
      }
    }

    if (batchIssues.length === 0) {
      console.log(`   ✅ Tất cả InventoryBatch đã được làm tròn!`)
    } else {
      console.log(`   ❌ Có ${batchIssues.length}/${inventoryBatches.length} bản ghi chưa làm tròn`)
    }

    // ===== Tổng kết =====
    console.log('\n📊 Tổng kết:')
    console.log(`   - InventoryStock có vấn đề: ${stockIssues.length}/${inventoryStocks.length}`)
    console.log(`   - InventoryBatch có vấn đề: ${batchIssues.length}/${inventoryBatches.length}`)

    if (stockIssues.length > 0 || batchIssues.length > 0) {
      console.log('\n💡 Chạy lại script: node scripts/roundInventoryNumbers.js')
    }

  } catch (error) {
    console.error('❌ Lỗi:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Chạy script
verifyInventoryNumbers()
  .then(() => {
    console.log('\n✨ Hoàn thành kiểm tra!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Thất bại:', error)
    process.exit(1)
  })
