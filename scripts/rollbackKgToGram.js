/**
 * Script ROLLBACK: Chuyển ngược từ "kg" về "gram"
 * Dùng khi muốn undo việc convert
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function rollbackKgToGram() {
  console.log('🔄 ROLLBACK: Chuyển đổi từ kg → gram...\n')

  try {
    // Lấy tất cả ingredients có unit = "kg" (đã được convert)
    const kgIngredients = await prisma.ingredient.findMany({
      where: { unit: 'kg' },
      include: {
        inventoryStock: {
          include: {
            batches: true
          }
        },
        dishIngredients: true
      }
    })

    if (kgIngredients.length === 0) {
      console.log('✅ Không có nguyên liệu nào dùng đơn vị "kg"')
      return
    }

    console.log(`📦 Tìm thấy ${kgIngredients.length} nguyên liệu đơn vị "kg"`)
    console.log(`⚠️  Bạn có chắc muốn chuyển TẤT CẢ về "gram"?\n`)

    // Chuyển đổi từng ingredient
    for (const ingredient of kgIngredients) {
      await prisma.$transaction(async (tx) => {
        console.log(`\n🔧 ${ingredient.name}`)

        // 1. Update Ingredient.unit
        await tx.ingredient.update({
          where: { id: ingredient.id },
          data: { unit: 'gram' }
        })

        // 2. Update InventoryStock
        if (ingredient.inventoryStock) {
          const stock = ingredient.inventoryStock

          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: {
              quantity: stock.quantity * 1000,
              avgUnitPrice: stock.avgUnitPrice / 1000,
              totalValue: stock.quantity * 1000 * (stock.avgUnitPrice / 1000),
              minStock: stock.minStock !== null ? stock.minStock * 1000 : null,
              maxStock: stock.maxStock !== null ? stock.maxStock * 1000 : null
            }
          })

          // 3. Update InventoryBatch
          for (const batch of stock.batches) {
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: {
                quantity: batch.quantity * 1000,
                unitPrice: batch.unitPrice / 1000
              }
            })
          }
        }

        // 4. Update DishIngredient
        for (const di of ingredient.dishIngredients) {
          const oldQty = parseFloat(di.quantity || '0')
          if (oldQty > 0) {
            await tx.dishIngredient.update({
              where: { id: di.id },
              data: {
                quantity: (oldQty * 1000).toString()
              }
            })
          }
        }

        console.log(`  ✅ Đã rollback`)
      })
    }

    console.log(`\n✅ Hoàn tất rollback ${kgIngredients.length} nguyên liệu`)

  } catch (error) {
    console.error('❌ Lỗi:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

console.log('⚠️  ROLLBACK SCRIPT - Chuyển kg → gram')
console.log('Đang chạy trong 3 giây...\n')

setTimeout(() => {
  rollbackKgToGram()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}, 3000)
