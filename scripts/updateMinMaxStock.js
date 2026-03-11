/**
 * Script cập nhật minStock và maxStock sau khi convert đơn vị
 * 
 * Áp dụng cho:
 * - Ingredients đã chuyển từ gram → kg (÷ 1000)
 * - Ingredients đã chuyển từ ml → liter (÷ 1000)
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateMinMaxStock() {
  console.log('🔄 Cập nhật minStock và maxStock sau khi convert đơn vị...\n')

  try {
    // Lấy tất cả InventoryStock kèm Ingredient
    const stocks = await prisma.inventoryStock.findMany({
      include: {
        ingredient: true
      }
    })

    console.log(`📦 Tìm thấy ${stocks.length} tồn kho\n`)

    let updatedCount = 0

    for (const stock of stocks) {
      const ingredient = stock.ingredient

      // Kiểm tra nếu ingredient đang dùng kg hoặc liter
      // (có thể đã được convert từ gram hoặc ml)
      if (ingredient.unit === 'kg' || ingredient.unit === 'liter') {
        let needUpdate = false
        let newMinStock = stock.minStock
        let newMaxStock = stock.maxStock

        // Nếu minStock > 100, có thể chưa convert (vẫn là gram/ml)
        // VD: minStock = 500 (gram) cần convert thành 0.5 (kg)
        if (stock.minStock !== null && stock.minStock > 100) {
          newMinStock = stock.minStock / 1000
          needUpdate = true
        }

        if (stock.maxStock !== null && stock.maxStock > 100) {
          newMaxStock = stock.maxStock / 1000
          needUpdate = true
        }

        if (needUpdate) {
          await prisma.inventoryStock.update({
            where: { id: stock.id },
            data: {
              minStock: newMinStock,
              maxStock: newMaxStock
            }
          })

          console.log(`✅ ${ingredient.name}:`)
          if (stock.minStock !== newMinStock) {
            console.log(`   minStock: ${stock.minStock} → ${newMinStock} ${ingredient.unit}`)
          }
          if (stock.maxStock !== newMaxStock) {
            console.log(`   maxStock: ${stock.maxStock} → ${newMaxStock} ${ingredient.unit}`)
          }

          updatedCount++
        }
      }
    }

    console.log(`\n📊 TÓM TẮT:`)
    console.log(`   - Tổng số tồn kho: ${stocks.length}`)
    console.log(`   - Đã cập nhật: ${updatedCount}`)
    console.log(`   - Không cần cập nhật: ${stocks.length - updatedCount}`)
    console.log('\n✅ Hoàn tất!')

  } catch (error) {
    console.error('❌ Lỗi:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateMinMaxStock()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
