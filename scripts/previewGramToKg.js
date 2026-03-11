/**
 * Script preview - Xem trước các thay đổi khi convert gram → kg
 * (KHÔNG thay đổi dữ liệu, chỉ hiển thị)
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function previewConversion() {
  console.log('👀 PREVIEW: Những gì sẽ thay đổi khi convert gram → kg\n')
  console.log('='.repeat(80))

  try {
    const gramIngredients = await prisma.ingredient.findMany({
      where: { unit: 'gram' },
      include: {
        inventoryStock: {
          include: {
            batches: true
          }
        },
        dishIngredients: {
          include: {
            dish: {
              select: { name: true }
            }
          }
        }
      }
    })

    if (gramIngredients.length === 0) {
      console.log('✅ Không có nguyên liệu nào dùng đơn vị "gram"')
      return
    }

    console.log(`\n📦 Tìm thấy ${gramIngredients.length} nguyên liệu:\n`)

    let totalStockValue = 0
    let totalNewStockValue = 0

    for (const ing of gramIngredients) {
      console.log(`\n${'─'.repeat(80)}`)
      console.log(`🥬 ${ing.name} (ID: ${ing.id})`)
      console.log(`   Category: ${ing.category || 'N/A'}`)

      if (ing.inventoryStock) {
        const stock = ing.inventoryStock
        const oldQty = stock.quantity
        const oldPrice = stock.avgUnitPrice
        const oldValue = stock.totalValue

        const newQty = oldQty / 1000
        const newPrice = oldPrice * 1000
        const newValue = newQty * newPrice

        totalStockValue += oldValue
        totalNewStockValue += newValue

        console.log(`\n   📊 InventoryStock:`)
        console.log(`      Quantity:  ${oldQty} gram  →  ${newQty} kg`)
        console.log(`      Avg Price: ${oldPrice.toLocaleString('vi-VN')} đ/gram  →  ${newPrice.toLocaleString('vi-VN')} đ/kg`)
        console.log(`      Value:     ${oldValue.toLocaleString('vi-VN')} đ  →  ${newValue.toLocaleString('vi-VN')} đ`)

        if (stock.minStock !== null) {
          console.log(`      minStock:  ${stock.minStock} gram  →  ${stock.minStock / 1000} kg`)
        }
        if (stock.maxStock !== null) {
          console.log(`      maxStock:  ${stock.maxStock} gram  →  ${stock.maxStock / 1000} kg`)
        }

        if (Math.abs(oldValue - newValue) > 1) {
          console.log(`      ⚠️  Chênh lệch value: ${(oldValue - newValue).toLocaleString('vi-VN')} đ`)
        }

        if (stock.batches.length > 0) {
          console.log(`\n   📦 ${stock.batches.length} Batches:`)
          stock.batches.forEach((batch, idx) => {
            const oldBQty = batch.quantity
            const oldBPrice = batch.unitPrice
            const newBQty = oldBQty / 1000
            const newBPrice = oldBPrice * 1000

            console.log(`      [${idx + 1}] ${batch.batchNumber}:`)
            console.log(`          ${oldBQty}g × ${oldBPrice}đ/g  →  ${newBQty}kg × ${newBPrice}đ/kg`)
          })
        }
      } else {
        console.log(`   ⚠️  Chưa có tồn kho`)
      }

      if (ing.dishIngredients.length > 0) {
        console.log(`\n   🍽️  Sử dụng trong ${ing.dishIngredients.length} món:`)
        ing.dishIngredients.forEach((di, idx) => {
          const oldQty = parseFloat(di.quantity || '0')
          const newQty = oldQty / 1000
          if (oldQty > 0) {
            console.log(`      [${idx + 1}] ${di.dish.name}: ${oldQty}g  →  ${newQty}kg`)
          }
        })
      }
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n📊 TỔNG KẾT:`)
    console.log(`   - Số nguyên liệu: ${gramIngredients.length}`)
    console.log(`   - Tổng giá trị kho (cũ): ${totalStockValue.toLocaleString('vi-VN')} đ`)
    console.log(`   - Tổng giá trị kho (mới): ${totalNewStockValue.toLocaleString('vi-VN')} đ`)

    const diff = Math.abs(totalStockValue - totalNewStockValue)
    if (diff > 1) {
      console.log(`   ⚠️  Chênh lệch: ${diff.toLocaleString('vi-VN')} đ (do làm tròn)`)
    } else {
      console.log(`   ✅ Giá trị kho không thay đổi (chính xác)`)
    }

    console.log(`\n💡 Để thực hiện chuyển đổi, chạy:`)
    console.log(`   node scripts/convertGramToKg.js`)

  } catch (error) {
    console.error('❌ Lỗi:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

previewConversion()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
