const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const fs = require('fs')
const path = require('path')

// Helper: Random number trong khoảng
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Helper: Random float với 2 chữ số thập phân
function randomFloat(min, max, decimals = 2) {
  const value = Math.random() * (max - min) + min
  return parseFloat(value.toFixed(decimals))
}

// Helper: Random date trong khoảng
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

// Generate batch number
function generateBatchNumber(ingredientId, batchIndex) {
  const timestamp = Date.now().toString().slice(-6)
  return `BATCH-${ingredientId}-${batchIndex}-${timestamp}`
}

async function seedInventoryStocks() {
  try {
    console.log('🌱 Bắt đầu seed InventoryStock và InventoryBatch...')

    // Đọc danh sách ingredients từ file
    const ingredientsPath = path.join(__dirname, 'ingredients-export.json')
    const ingredientsData = JSON.parse(fs.readFileSync(ingredientsPath, 'utf-8'))

    console.log(`📦 Tìm thấy ${ingredientsData.length} nguyên liệu`)

    let stockCount = 0
    let batchCount = 0

    for (const ingredient of ingredientsData) {
      console.log(`\n🔄 Xử lý: ${ingredient.name} (ID: ${ingredient.id})`)

      // 1. Tạo InventoryStock cho ingredient
      const numBatches = randomInt(1, 3) // Ngẫu nhiên 1-3 lô

      // Tạo batches data trước
      const batchesData = []
      let totalQuantity = 0
      let totalValue = 0
      const now = new Date()

      for (let i = 1; i <= numBatches; i++) {
        const quantity = randomFloat(10, 500) // 10-500 đơn vị
        const unitPrice = randomFloat(5000, 200000) // 5k-200k VNĐ
        const importDate = randomDate(
          new Date(2026, 0, 1), // Từ 1/1/2026
          new Date(2026, 2, 10)  // Đến 10/3/2026
        )
        const expiryDate = randomDate(
          new Date(2026, 3, 1),  // Từ 1/4/2026
          new Date(2026, 11, 31) // Đến 31/12/2026
        )

        batchesData.push({
          batchNumber: generateBatchNumber(ingredient.id, i),
          quantity,
          unitPrice,
          importDate,
          expiryDate
        })

        totalQuantity += quantity
        totalValue += quantity * unitPrice
      }

      const avgUnitPrice = totalQuantity > 0 ? totalValue / totalQuantity : 0
      const lastImport = batchesData.length > 0
        ? new Date(Math.max(...batchesData.map(b => b.importDate.getTime())))
        : null

      // 2. Upsert InventoryStock và tạo batches
      const inventoryStock = await prisma.inventoryStock.upsert({
        where: { ingredientId: ingredient.id },
        update: {
          quantity: totalQuantity,
          minStock: randomFloat(5, 50),
          maxStock: randomFloat(100, 1000),
          avgUnitPrice: parseFloat(avgUnitPrice.toFixed(2)),
          totalValue: parseFloat(totalValue.toFixed(2)),
          lastImport: lastImport,
          lastExport: Math.random() > 0.5 ? randomDate(lastImport || now, now) : null,
          batches: {
            deleteMany: {}, // Xóa batches cũ nếu có
            create: batchesData
          }
        },
        create: {
          ingredientId: ingredient.id,
          quantity: totalQuantity,
          minStock: randomFloat(5, 50),
          maxStock: randomFloat(100, 1000),
          avgUnitPrice: parseFloat(avgUnitPrice.toFixed(2)),
          totalValue: parseFloat(totalValue.toFixed(2)),
          lastImport: lastImport,
          lastExport: Math.random() > 0.5 ? randomDate(lastImport || now, now) : null,
          batches: {
            create: batchesData
          }
        },
        include: {
          batches: true
        }
      })

      stockCount++
      batchCount += inventoryStock.batches.length

      console.log(`  ✅ Tạo InventoryStock: quantity=${totalQuantity.toFixed(2)}, batches=${inventoryStock.batches.length}`)
      inventoryStock.batches.forEach((batch, idx) => {
        console.log(`     📦 Batch ${idx + 1}: ${batch.batchNumber} - Qty: ${batch.quantity.toFixed(2)} - Price: ${batch.unitPrice.toFixed(0)}đ`)
      })
    }

    console.log('\n✨ Hoàn thành!')
    console.log(`📊 Tổng kết:`)
    console.log(`   - InventoryStock: ${stockCount}/${ingredientsData.length}`)
    console.log(`   - InventoryBatch: ${batchCount}`)
    console.log(`   - Trung bình: ${(batchCount / stockCount).toFixed(1)} batch/stock`)

  } catch (error) {
    console.error('❌ Lỗi:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Chạy script
seedInventoryStocks()
  .then(() => {
    console.log('\n🎉 Seed thành công!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seed thất bại:', error)
    process.exit(1)
  })
