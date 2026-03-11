/**
 * Script chuyển đổi tất cả Ingredient từ "ml" sang "liter"
 * 
 * Các thay đổi:
 * 1. Ingredient.unit: "ml" → "liter"
 * 2. InventoryStock.quantity: ml → liter (÷ 1000)
 * 3. InventoryStock.avgUnitPrice: ml → liter (× 1000)
 * 4. InventoryStock.totalValue: không đổi (quantity × avgUnitPrice)
 * 5. InventoryBatch.quantity: ml → liter (÷ 1000)
 * 6. InventoryBatch.unitPrice: ml → liter (× 1000)
 * 7. DishIngredient.quantity: ml → liter (÷ 1000)
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function convertMlToLiter() {
  console.log('🔄 Bắt đầu chuyển đổi đơn vị từ ml → liter...\n')

  try {
    // Lấy tất cả ingredients có unit = "ml"
    const mlIngredients = await prisma.ingredient.findMany({
      where: { unit: 'ml' },
      include: {
        inventoryStock: {
          include: {
            batches: true
          }
        },
        dishIngredients: true
      }
    })

    if (mlIngredients.length === 0) {
      console.log('✅ Không có nguyên liệu nào dùng đơn vị "ml"')
      return
    }

    console.log(`📦 Tìm thấy ${mlIngredients.length} nguyên liệu đơn vị "ml"\n`)

    // Chuyển đổi từng ingredient trong transaction
    for (const ingredient of mlIngredients) {
      await prisma.$transaction(async (tx) => {
        console.log(`\n🔧 Đang xử lý: ${ingredient.name}`)

        // 1. Cập nhật Ingredient.unit
        await tx.ingredient.update({
          where: { id: ingredient.id },
          data: { unit: 'liter' }
        })
        console.log(`  ✅ Unit: ml → liter`)

        // 2. Cập nhật InventoryStock (nếu có)
        if (ingredient.inventoryStock) {
          const stock = ingredient.inventoryStock
          const oldQuantity = stock.quantity
          const oldAvgPrice = stock.avgUnitPrice

          const newQuantity = oldQuantity / 1000
          const newAvgPrice = oldAvgPrice * 1000
          const newTotalValue = newQuantity * newAvgPrice
          const newMinStock = stock.minStock !== null ? stock.minStock / 1000 : null
          const newMaxStock = stock.maxStock !== null ? stock.maxStock / 1000 : null

          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: {
              quantity: newQuantity,
              avgUnitPrice: newAvgPrice,
              totalValue: newTotalValue,
              minStock: newMinStock,
              maxStock: newMaxStock
            }
          })
          console.log(`  ✅ Stock: ${oldQuantity}ml → ${newQuantity}L`)
          console.log(`  ✅ Price: ${oldAvgPrice}đ/ml → ${newAvgPrice}đ/L`)
          console.log(`  ✅ Value: ${stock.totalValue}đ → ${newTotalValue}đ`)

          // 3. Cập nhật InventoryBatch
          if (stock.batches.length > 0) {
            for (const batch of stock.batches) {
              const oldBatchQty = batch.quantity
              const oldBatchPrice = batch.unitPrice

              const newBatchQty = oldBatchQty / 1000
              const newBatchPrice = oldBatchPrice * 1000

              await tx.inventoryBatch.update({
                where: { id: batch.id },
                data: {
                  quantity: newBatchQty,
                  unitPrice: newBatchPrice
                }
              })
            }
            console.log(`  ✅ Cập nhật ${stock.batches.length} lô hàng`)
          }
        }

        // 4. Cập nhật DishIngredient
        if (ingredient.dishIngredients.length > 0) {
          for (const di of ingredient.dishIngredients) {
            const oldQty = parseFloat(di.quantity || '0')
            if (oldQty > 0) {
              const newQty = oldQty / 1000

              await tx.dishIngredient.update({
                where: { id: di.id },
                data: {
                  quantity: newQty.toString()
                }
              })
            }
          }
          console.log(`  ✅ Cập nhật ${ingredient.dishIngredients.length} công thức món ăn`)
        }

        console.log(`  ✨ Hoàn thành: ${ingredient.name}`)
      })
    }

    console.log('\n\n📊 TÓM TẮT:')
    console.log(`✅ Đã chuyển đổi ${mlIngredients.length} nguyên liệu từ ml → liter`)
    console.log('\n🎉 Hoàn tất!')

  } catch (error) {
    console.error('\n❌ LỖI:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Xác nhận trước khi chạy
console.log('⚠️  CẢNH BÁO: Script này sẽ thay đổi dữ liệu trong database!')
console.log('📋 Các thay đổi:')
console.log('   - Ingredient.unit: ml → liter')
console.log('   - InventoryStock.quantity: ÷ 1000')
console.log('   - InventoryStock.avgUnitPrice: × 1000')
console.log('   - InventoryBatch: tương tự')
console.log('   - DishIngredient.quantity: ÷ 1000')
console.log('\n💡 Backup database trước khi chạy!')
console.log('\nĐang chạy trong 3 giây...\n')

setTimeout(() => {
  convertMlToLiter()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}, 3000)
