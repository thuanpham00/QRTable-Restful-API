/**
 * Script kiểm tra tính nhất quán của dữ liệu sau khi convert đơn vị
 * Hiển thị chi tiết tất cả các bảng: Ingredient, InventoryStock, InventoryBatch, DishIngredient
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function verifyConversion() {
  console.log('🔍 KIỂM TRA DỮ LIỆU SAU KHI CONVERT ĐƠN VỊ\n')
  console.log('='.repeat(90))

  try {
    // Lấy tất cả ingredients có unit = kg hoặc liter
    const ingredients = await prisma.ingredient.findMany({
      where: {
        OR: [{ unit: 'kg' }, { unit: 'liter' }]
      },
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
      },
      orderBy: { name: 'asc' }
    })

    console.log(`\n📦 Tìm thấy ${ingredients.length} nguyên liệu dùng đơn vị kg/liter\n`)

    const issues = []
    let totalStockValue = 0

    for (const ing of ingredients) {
      console.log(`\n${'─'.repeat(90)}`)
      console.log(`🥬 ${ing.name} (ID: ${ing.id}) - Unit: ${ing.unit}`)
      console.log(`   Category: ${ing.category || 'N/A'}`)

      // 1. Kiểm tra InventoryStock
      if (ing.inventoryStock) {
        const stock = ing.inventoryStock
        console.log(`\n   📊 InventoryStock:`)
        console.log(`      Quantity:     ${stock.quantity} ${ing.unit}`)
        console.log(`      minStock:     ${stock.minStock ?? 'null'} ${ing.unit}`)
        console.log(`      maxStock:     ${stock.maxStock ?? 'null'} ${ing.unit}`)
        console.log(`      avgUnitPrice: ${stock.avgUnitPrice.toLocaleString('vi-VN')} đ/${ing.unit}`)
        console.log(`      totalValue:   ${stock.totalValue.toLocaleString('vi-VN')} đ`)

        totalStockValue += stock.totalValue

        // Kiểm tra totalValue có khớp không
        const calculatedValue = stock.quantity * stock.avgUnitPrice
        const diff = Math.abs(calculatedValue - stock.totalValue)
        if (diff > 1) {
          const issue = `${ing.name}: totalValue không khớp (${stock.totalValue} vs ${calculatedValue})`
          issues.push(issue)
          console.log(`      ⚠️  ${issue}`)
        }

        // Cảnh báo nếu minStock/maxStock > 100 (có thể chưa convert)
        if (stock.minStock && stock.minStock > 100) {
          const issue = `${ing.name}: minStock = ${stock.minStock} (có thể chưa convert?)`
          issues.push(issue)
          console.log(`      ⚠️  ${issue}`)
        }
        if (stock.maxStock && stock.maxStock > 100) {
          const issue = `${ing.name}: maxStock = ${stock.maxStock} (có thể chưa convert?)`
          issues.push(issue)
          console.log(`      ⚠️  ${issue}`)
        }

        // 2. Kiểm tra InventoryBatch
        if (stock.batches.length > 0) {
          console.log(`\n   📦 ${stock.batches.length} Batches:`)
          let totalBatchQty = 0
          let totalBatchValue = 0

          stock.batches.forEach((batch, idx) => {
            const batchValue = batch.quantity * batch.unitPrice
            totalBatchQty += batch.quantity
            totalBatchValue += batchValue

            console.log(`      [${idx + 1}] ${batch.batchNumber}:`)
            console.log(`          Quantity:  ${batch.quantity} ${ing.unit}`)
            console.log(`          UnitPrice: ${batch.unitPrice.toLocaleString('vi-VN')} đ/${ing.unit}`)
            console.log(`          Value:     ${batchValue.toLocaleString('vi-VN')} đ`)
            console.log(`          Status:    ${batch.status}`)

            // Cảnh báo nếu quantity > 1000 (có thể chưa convert)
            if (batch.quantity > 1000) {
              const issue = `${ing.name} - Batch ${batch.batchNumber}: quantity = ${batch.quantity} (quá lớn?)`
              issues.push(issue)
              console.log(`          ⚠️  ${issue}`)
            }
          })

          // So sánh tổng quantity của batches với stock quantity
          const qtyDiff = Math.abs(totalBatchQty - stock.quantity)
          if (qtyDiff > 0.01) {
            const issue = `${ing.name}: Tổng batch quantity (${totalBatchQty}) ≠ stock quantity (${stock.quantity})`
            issues.push(issue)
            console.log(`\n      ⚠️  ${issue}`)
          }
        }
      } else {
        console.log(`   ⚠️  Chưa có tồn kho`)
      }

      // 3. Kiểm tra DishIngredient
      if (ing.dishIngredients.length > 0) {
        console.log(`\n   🍽️  Sử dụng trong ${ing.dishIngredients.length} món:`)
        ing.dishIngredients.forEach((di, idx) => {
          const qty = parseFloat(di.quantity || '0')
          console.log(`      [${idx + 1}] ${di.dish.name}: ${qty} ${ing.unit}`)

          // Cảnh báo nếu quantity > 100 trong công thức (có thể chưa convert)
          if (qty > 100) {
            const issue = `${ing.name} trong ${di.dish.name}: quantity = ${qty} ${ing.unit} (quá lớn?)`
            issues.push(issue)
            console.log(`          ⚠️  ${issue}`)
          }
        })
      }
    }

    // Tổng kết
    console.log(`\n${'='.repeat(90)}`)
    console.log(`\n📊 TỔNG KẾT:`)
    console.log(`   - Tổng số nguyên liệu (kg/liter): ${ingredients.length}`)
    console.log(`   - Tổng giá trị kho: ${totalStockValue.toLocaleString('vi-VN')} đ`)
    console.log(`   - Số vấn đề phát hiện: ${issues.length}`)

    if (issues.length > 0) {
      console.log(`\n⚠️  CÁC VẤN ĐỀ PHÁT HIỆN:`)
      issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`)
      })
      console.log(`\n💡 Chạy script fix nếu cần:`)
      console.log(`   node scripts/updateMinMaxStock.js`)
    } else {
      console.log(`\n✅ Tất cả dữ liệu nhất quán!`)
    }

  } catch (error) {
    console.error('❌ Lỗi:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

verifyConversion()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
